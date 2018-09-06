var darrGetImageType = function(blob, type) {
  if (typeof blob.images == "object") {
    var fallback;
    for (var i = 0; i < blob.images.length; i++) {
      var ref = blob.images[i];
      if (ref.coverType == type) {
        return type;
      }
      else {
        fallback = ref.coverType;
      }
    }
    return fallback;
  }
  return false;
};
var darrGetImagePoster = function(blob) {
  return darrGetImageType(blob, "poster");
};
var darrGetImageBackground = function(blob) {
  return darrGetImageType(blob, "fanart");
};

var darrGetSeasonCount = function(blob) {
  var count = 0;
  for (var i = 0; i < blob.seasons.length; i++) {
    var ref = blob.seasons[i];
    if (ref.seasonNumber !== 0/* && ref.monitored*/) {
      count++;
    }
  }
  return Math.max(1, count); // assume at least 1 season
};

var darrGetAlternateTitles = function(blob) {
  var alts = [];
  if (typeof blob.alternateTitles !== "undefined") for (var i = 0; i < blob.alternateTitles.length; i++) {
    // sonarr
    var ref = blob.alternateTitles[i];
    if (ref.sceneSeasonNumber == -1) {
      alts.push(ref.title);
    }
  }
  if (typeof blob.alternativeTitles !== "undefined") for (var i = 0; i < blob.alternativeTitles.length; i++) {
    // radarr
    var ref = blob.alternativeTitles[i];
    alts.push(ref.title);
  }
  if (alts.length == 0) {
    return "";
  }
  return alts.join("; ");
};

var darrMakeGenreLabels = function(blob) {
  var container = $("<div>");
  for (var i = 0; i < blob.genres.length; i++) {
    var genre = blob.genres[i];
    var badge = $("<span>")
      .addClass("badge badge-dark mr-1 p-2")
      .text(genre);
    container.append(badge);
  }
  return container.html();
};

var darrMakeMetaLabels = function(blob) {
  var container = $("<div>");
  if (darrIsSonarr(blob)) {
    var episodeCount = $("<span>")
      .addClass("font-weight-bold text-muted mr-2")
      .text("{0} episode{1}".format(
        blob.episodeCount,
        (blob.episodeCount > 1) ? "s" : ""
      ));
    container.append(episodeCount);
  }
  else {
    var movieCount = $("<span>")
      .addClass("font-weight-bold text-muted mr-2")
      .text("Movie");
    container.append(movieCount);
  }
  var rating = $("<span>")
    .addClass("badge badge-dark text-light py-1 px-2")
    .text(blob.certification);
  container.append(rating);
  return container.html();
};

var darrMakeSearchFields = function(blob) {
  return [
    blob.cleanTitle,
    (typeof blob.alternateTitles == "undefined") ? blob.alternativeTitles.join(" ") : blob.alternateTitles.join(" "),
    blob.genres.join(" "),
    blob.overview,
    blob.title,
    blob.year
  ].join(" ");
};

var darrIsSonarr = function(blob) {
  if (typeof blob.tmdbId !== "undefined") {
    return false;
  }
  return true;
};
