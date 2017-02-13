import {db_url as dbURL} from 'api/config/database';
import request from 'shared/JSONRequest';
import sanitizeResponse from 'api/utils/sanitizeResponse';
import templates from 'api/templates';
import entities from 'api/entities';

import instanceModel from 'api/odm';
import connectionsModel from './connectionsModel.js';

const model = instanceModel(connectionsModel);

let normalizeConnection = (connection, docId) => {
  connection.targetRange = connection.targetRange || {text: ''};
  connection.sourceRange = connection.sourceRange || {text: ''};
  connection.inbound = connection.targetDocument === docId;
  connection.range = connection.inbound ? connection.targetRange : connection.sourceRange;
  connection.text = connection.inbound ? connection.sourceRange.text : connection.targetRange.text;
  connection.connectedDocument = connection.inbound ? connection.sourceDocument : connection.targetDocument;
  return connection;
};

let normalizeConnectedDocumentData = (connection, connectedDocument) => {
  connection.connectedDocumentTemplate = connectedDocument.template;
  connection.connectedDocumentType = connectedDocument.isEntity ? 'entity' : 'document';
  connection.connectedDocumentTitle = connectedDocument.title;
  connection.connectedDocumentIcon = connectedDocument.icon;
  connection.connectedDocumentPublished = Boolean(connectedDocument.published);
  connection.connectedDocumentMetadata = connectedDocument.metadata || {};
  connection.connectedDocumentCreationDate = connectedDocument.creationDate;
  return connection;
};

export default {
  get() {
    return model.get();
  },

  getById(id) {
    return model.getById(id);
  },

  getByDocument(id, language) {
    //return request.get(`${dbURL}/_design/references/_view/by_document?key="${id}"`)
    return model.get({$or: [{targetDocument: id}, {sourceDocument: id}]})
    .then((response) => {
      let connections = response.map((connection) => normalizeConnection(connection, id));
      let requestDocuments = [];
      connections.forEach((connection) => {
        let promise = entities.get(connection.connectedDocument, language)
        .then((connectedDocument) => {
          normalizeConnectedDocumentData(connection, connectedDocument[0]);
        });
        requestDocuments.push(promise);
      });

      return Promise.all(requestDocuments)
      .then(() => {
        return connections;
      });
    });
  },

  getByTarget(docId) {
    return model.get({targetDocument: docId});
  },

  countByRelationType(typeId) {
    return model.count({relationtype: typeId});
  },

  save(connection, language) {
    return model.save(connection)
    .then((result) => {
      return normalizeConnection(result, connection.sourceDocument);
    })
    .then((result) => {
      return Promise.all([result, entities.getById(result.connectedDocument, language)]);
    })
    .then(([result, connectedDocument]) => {
      return normalizeConnectedDocumentData(result, connectedDocument);
    });
  },

  saveEntityBasedReferences(entity, language) {
    if (!entity.template) {
      return Promise.resolve([]);
    }

    return templates.getById(entity.template)
    .then((template) => {
      const selects = template.properties.filter((prop) => prop.type === 'select' || prop.type === 'multiselect');
      const entitySelects = [];
      return Promise.all(selects.map((select) => {
        return templates.getById(select.content)
        .then((result) => {
          if (result) {
            entitySelects.push(select.name);
          }
        });
      }))
      .then(() => entitySelects);
    })
    .then((properties) => {
      return Promise.all([
        properties,
        this.getByDocument(entity.sharedId, language)
      ]);
    })
    .then(([properties, references]) => {
      let values = properties.reduce((memo, property) => {
        let propertyValues = entity.metadata[property] || [];
        if (typeof propertyValues === 'string') {
          propertyValues = [propertyValues];
        }
        return memo.concat(propertyValues.map(value => {
          return {property, value};
        }));
      }, []);

      const toDelete = references.filter((ref) => {
        let isInValues = false;
        values.forEach((item) => {
          if (item.property === ref.sourceProperty && ref.targetDocument === item.value) {
            isInValues = true;
          }
        });
        return !ref.inbound && !isInValues && ref.sourceType === 'metadata';
      });

      const toCreate = values.filter((item) => {
        let isInReferences = false;
        references.forEach((ref) => {
          if (item.property === ref.sourceProperty && ref.targetDocument === item.value) {
            isInReferences = true;
          }
        });
        return !isInReferences;
      });

      const deletes = toDelete.map((ref) => this.delete(ref._id));
      const creates = toCreate.map((item) => this.save({
        sourceType: 'metadata',
        sourceDocument: entity.sharedId,
        targetDocument: item.value,
        sourceProperty: item.property
      }, language));

      return Promise.all(deletes.concat(creates));
    });
  },

  delete(id) {
    return model.delete(id);
  },

  deleteTextReferences(sharedId, language) {
    return model.delete({sourceDocument: sharedId, language});
  }
};
