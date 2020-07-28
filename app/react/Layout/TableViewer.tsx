import React, { Component } from 'react';

import Immutable from 'immutable';
import { connect } from 'react-redux';
import { TemplateSchema } from 'shared/types/templateType';
import { PropertySchema } from 'shared/types/commonTypes';
import { TableRow } from 'app/Library/components/TableRow';

export interface DocumentViewerProps {
  rowListZoomLevel: number;
  documents: any;
  storeKey: 'library' | 'uploads';
  clickOnDocument: (...args: any[]) => any;
  onSnippetClick: (...args: any[]) => any;
  deleteConnection: (...args: any[]) => any;
  search: any;
  templates: any;
  thesauris: any;
}

function columnsFromTemplates(templates: TemplateSchema[]) {
  return templates.reduce((properties: PropertySchema[], template: TemplateSchema) => {
    const propsToAdd: PropertySchema[] = [];
    template.get('properties', Immutable.Map()).forEach((property: PropertySchema) => {
      if (!properties.find(columnProperty => property.get('name') === columnProperty.get('name'))) {
        propsToAdd.push(property);
      }
    });
    return properties.concat(propsToAdd);
  }, []);
}

class TableViewerComponent extends Component<DocumentViewerProps> {
  constructor(props: DocumentViewerProps) {
    super(props);
    this.getColumns();
  }

  private getColumns() {
    let columns = [];
    const queriedTemplates = (this.props.documents || []).getIn([
      'aggregations',
      'all',
      '_types',
      'buckets',
    ]);
    if (queriedTemplates) {
      const templateIds = queriedTemplates
        .filter((template: any) => template.getIn(['filtered', 'doc_count']) > 0)
        .map((template: any) => template.get('key'));

      const templates = this.props.templates.filter((t: TemplateSchema) =>
        templateIds.find((id: any) => t.get('_id') === id)
      );

      const commonColumns = [
        ...templates.get(0).get('commonProperties'),
        Immutable.fromJS({ label: 'Template', name: 'templateName' }),
      ];
      columns = commonColumns.concat(columnsFromTemplates(templates));
    }
    return columns;
  }

  render() {
    const columns = this.getColumns();
    return (
      <div className="tableview-wrapper">
        <table>
          <thead>
            <tr>
              {columns.map((column: any, index: number) => (
                <th className={!index ? 'sticky-col' : ''} key={index}>
                  {column.get('label')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {this.props.documents.get('rows').map((document: any, index: number) => (
              <TableRow
                {...{
                  document,
                  columns: columns,
                  key: index,
                  onClick: this.props.clickOnDocument,
                  storeKey: this.props.storeKey,
                  templates: this.props.templates,
                  thesauris: this.props.thesauris,
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

const mapStateToProps = (state: any, props: DocumentViewerProps) => ({
  templates: state.templates,
  thesauris: state.thesauris,
  authorized: !!state.user.get('_id'),
  selectedDocuments: state[props.storeKey].ui.get('selectedDocuments'),
});

export const TableViewer = connect(mapStateToProps)(TableViewerComponent);
