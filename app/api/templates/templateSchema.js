import Ajv from 'ajv';
import ajvKeywords from 'ajv-keywords';
import { templateTypes } from 'shared/templateTypes';
import model from 'api/templates/templatesModel';

const ajv = ajvKeywords(Ajv({ allErrors: true }), ['uniqueItemProperties']);

const fieldTypes = Object.values(templateTypes);

ajv.addKeyword('uniqueName', {
  async: true,
  errors: false,
  type: 'object',
  validate: async (schema, data) => {
    if (!schema) {
      return true;
    }
    const regex = new RegExp(`^${data.name}$`, 'i');
    const [similarTemplate] = await model.get({ _id: { $ne: data._id }, name: regex });
    if (similarTemplate) {
      return false;
    }
    return true;
  }
});

ajv.addKeyword('requireTitleProperty', {
  errors: false,
  type: 'array',
  validate: function (schema, properties) {
    return properties.some(prop => prop.name === 'title');
  }
});

ajv.addKeyword('uniquePropertyFields', {
  errors: false,
  type: 'object',
  validate: function (fields, data) {
    if (!fields.length) {
      return true;
    }
    const uniqueValues = fields.reduce((memo, field) => ({ ...memo, [field]: new Set() }), {});
    for (let property of [...data.properties || [], ...data.commonProperties || []]) {
      for (let field of fields) {
        const value = property[field] && property[field].toLowerCase().trim();
        if (value && uniqueValues[field].has(value)) {
          return false;
        }
        uniqueValues[field].add(value);
      }
    }
    return true;
  }
});

ajv.addKeyword('requireContentForSelectFields', {
  errors: false,
  type: 'object',
  validate: function (schema, data) {
    if (!schema) {
      return true;
    }
    if (['multiselect', 'select'].includes(data.type)) {
      return !!(data.content && data.content.length);
    }

    return true;
  }
});

ajv.addKeyword('requireRelationTypeForRelationship', {
  errors: false,
  type: 'object',
  validate: function (schema, data) {
    if (!schema) {
      return true;
    }
    if (data.type === 'relationship') {
      return !!(data.relationType && data.relationType.length);
    }
    return true;
  }
});

ajv.addKeyword('requireInheritPropertyForInheritingRelationship', {
  errors: false,
  type: 'object',
  validate: function (schema, data) {
    if (!schema) {
      return true;
    }
    if (data.type === 'relationship' && data.inherit) {
      return !!data.inheritProperty;
    }
    return true;
  }
});

const schema = {
  $schema: 'http://json-schema.org/schema#',
  $async: true,
  definitions: {
    property: {
      type: 'object',
      required: ['label', 'name', 'type'],
      requireContentForSelectFields: true,
      requireRelationTypeForRelationship: true,
      requireInheritPropertyForInheritingRelationship: true,
      properties: { 
        id: { type: 'string' },
        label: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        isCommonProperty: { type: 'boolean' },
        type: { type: 'string', enum: fieldTypes },
        prioritySorting: { type: 'boolean' },
        content: { type: 'string', minLength: 1 },
        inherit: { type: 'boolean' },
        inheritProperty: { type: 'string', minLength: 1 },
        filter: { type: 'boolean' },
        noLabel: { type: 'boolean' },
        fullWidth: { type: 'boolean' },
        defaultfilter: { type: 'boolean' },
        required: { type: 'boolean' },
        sortable: { type: 'boolean' },
        showInCard: { type: 'boolean' },
        style: { type: 'string' },
        nestedProperties: {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      }
    }
  },
  type: 'object',
  uniqueName: true,
  required: ['name', 'commonProperties', 'properties'],
  uniquePropertyFields: ['id', 'name', 'label', 'relationType'],
  properties: {
    _id: { type: 'string' },
    name: { type: 'string', minLength: 1 },
    color: { type: 'string', default: '' },
    default: { type: 'boolean', default: false },
    commonProperties: {
      type: 'array',
      requireTitleProperty: true,
      minItems: 1,
      items: {
        $ref: '#/definitions/property',
      }
    },
    properties: {
      type: 'array',
      items: {
        $ref: '#/definitions/property'
      }
    }
  }
};

const validateTemplate = ajv.compile(schema);

export {
  validateTemplate
};
