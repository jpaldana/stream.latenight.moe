"use strict";

var _createClass = (function() {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }
  return function(Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
})();

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError(
      "this hasn't been initialised - super() hasn't been called"
    );
  }
  return call && (typeof call === "object" || typeof call === "function")
    ? call
    : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError(
      "Super expression must either be null or a function, not " +
        typeof superClass
    );
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass)
    Object.setPrototypeOf
      ? Object.setPrototypeOf(subClass, superClass)
      : (subClass.__proto__ = superClass);
}

var PosterContainer = (function(_React$Component) {
  _inherits(PosterContainer, _React$Component);

  function PosterContainer() {
    _classCallCheck(this, PosterContainer);

    return _possibleConstructorReturn(
      this,
      (
        PosterContainer.__proto__ || Object.getPrototypeOf(PosterContainer)
      ).apply(this, arguments)
    );
  }

  _createClass(PosterContainer, [
    {
      key: "render",
      value: function render() {
        var posterImageStyle = {
          backgroundImage: "url(" + this.props.poster + ")"
        };
        var seasonText = this.props.seasons > 1 ? "seasons" : "season";
        return React.createElement(
          "div",
          { className: "poster-container" },
          React.createElement(
            "a",
            { href: this.props.link },
            React.createElement("div", {
              className: "poster-image shadow",
              "data-src": this.props.poster
            }),
            React.createElement(
              "span",
              { className: "poster-title text-light ellipsis" },
              this.props.title
            ),
            React.createElement(
              "span",
              { className: "poster-season text-muted" },
              this.props.seasons,
              " ",
              seasonText
            )
          )
        );
      }
    }
  ]);

  return PosterContainer;
})(React.Component);
