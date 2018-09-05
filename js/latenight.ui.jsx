class PosterContainer extends React.Component {
  render() {
    var posterImageStyle = {
      backgroundImage: `url(${this.props.poster})`
    };
    var seasonText = (this.props.seasons > 1) ? "seasons" : "season";
    return (
      <div className="poster-container">
        <a href={this.props.link}>
          <div className="poster-image shadow" data-src={this.props.poster}></div>
          <span className="poster-title text-light ellipsis">{this.props.title}</span>
          <span className="poster-season text-muted">{this.props.seasons} {seasonText}</span>
        </a>
      </div>
    );
  }
}
