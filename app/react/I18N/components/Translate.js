import PropTypes from 'prop-types';
import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { actions } from 'app/I18N';

const parseMarkdownMarker = (line, regexp, groupName, wrapper) => {
  const matches = line.match(regexp);
  if (matches == null) {
    return matches;
  }
  const parts = matches.input.split(matches[0]);
  return (
    <>
      {parts[0]}
      {wrapper(matches.groups[groupName])}
      {parts[1]}
    </>
  );
};

const parseMarkdownBoldMarker = line =>
  parseMarkdownMarker(line, /\*\*(?<bold>.*)\*\*/, 'bold', text => <strong>{text}</strong>);

const parseMarkdownItalicMarker = line =>
  parseMarkdownMarker(line, /\*(?<italic>.*)\*/, 'italic', text => <i>{text}</i>);

class Translate extends Component {
  static resetCachedTranslation() {
    Translate.translation = null;
  }

  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
  }

  onClick(e) {
    if (this.props.i18nmode) {
      e.stopPropagation();
      e.preventDefault();
      this.props.edit(this.props.context, this.props.translationKey);
    }
  }

  render() {
    const lines = this.props.children.split('\n');
    return (
      <span
        onClick={this.onClick}
        className={this.props.i18nmode ? 'translation active' : 'translation'}
      >
        {lines.map((line, index) => {
          const boldMatches = parseMarkdownBoldMarker(line);
          const italicMatches = parseMarkdownItalicMarker(line);
          return (
            <Fragment key={line}>
              {boldMatches ||
                italicMatches || ( // eslint-disable-next-line react/jsx-no-useless-fragment
                  <>{line}</>
                )}
              {index < lines.length - 1 && <br />}
            </Fragment>
          );
        })}
      </span>
    );
  }
}

Translate.defaultProps = {
  i18nmode: false,
  context: 'System',
  edit: false,
  translationKey: '',
};

Translate.propTypes = {
  translationKey: PropTypes.string,
  context: PropTypes.string,
  edit: PropTypes.func,
  i18nmode: PropTypes.bool,
  children: PropTypes.string.isRequired,
};

const mapStateToProps = (state, props) => {
  if (!Translate.translation || Translate.translation.locale !== state.locale) {
    const translations = state.translations.toJS();
    Translate.translation = translations.find(t => t.locale === state.locale) || { contexts: [] };
  }
  const _ctx = props.context || 'System';
  const key = props.translationKey || props.children;
  const context = Translate.translation.contexts.find(ctx => ctx.id === _ctx) || { values: {} };
  const canEditThisValue = _ctx === 'System' || !!context.values[props.children];
  return {
    translationKey: key,
    children: context.values[key] || props.children,
    i18nmode: state.inlineEdit.get('inlineEdit') && canEditThisValue,
  };
};

function mapDispatchToProps(dispatch) {
  return bindActionCreators({ edit: actions.inlineEditTranslation }, dispatch);
}

export { mapStateToProps, Translate };
export default connect(mapStateToProps, mapDispatchToProps)(Translate);
