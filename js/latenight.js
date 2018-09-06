var LATENIGHT_API = "https://public-api.aldana.io/stream";
var MEDIA_PROXY_API = "https://mei.aldana.io";
var STORAGE_SUPPORTED = (typeof(Storage) !== "undefined");
var STORAGE_CACHEHIT_TIME = 300; //-1; //300;
var DEFAULT_IMAGE = "/images/logo-cat.png";
var DEFAULT_PLACEHOLDER = "/images/blank-episode.jpg";

var PLAYER_ACTIVE_MEDIA = false;
var PLAYER_ACTIVE_ROOM = false;

var initPathname = function() {
  switch (location.pathname[1]) {
    case 't': // sonarr/tv
      $("[data-group='generic'], [data-group='info']").removeClass("collapse");
      request({
        "cid": "listing",
        "request": "listing"
      }, buildInfo, ajaxGenericProgress, {
        "type": "tv",
        "slug": location.pathname.substring(3)
      });
      break;
    case 'm': // radarr/movie
      $("[data-group='generic'], [data-group='info']").removeClass("collapse");
      request({
        "cid": "listing",
        "request": "listing"
      }, buildInfo, ajaxGenericProgress, {
        "type": "movie",
        "slug": location.pathname.substring(3)
      });
      break;
    case 'p': // sonarr/radarr player (interstitial)
      $("[data-group='player']").removeClass("collapse");
      var id = location.pathname.substring(5);
      id = id.substring(0, id.indexOf('/'));
      var room = location.pathname.substring(location.pathname.lastIndexOf('/') + 1);
      if (room == id) {
        room = false;
      }
      var type = (location.pathname[3] === 's') ? "sonarr" : "radarr";
      if (type == "sonarr") {
        request({
          "request": "episode",
          "id": id,
          "type": type
        }, buildPlayer, ajaxGenericProgress, {
          "room": room,
          "type": type
        });
      }
      else {
        request({
          "cid": "listing",
          "request": "listing",
          "id": id,
          "type": type
        }, buildPlayer, ajaxGenericProgress, {
          "room": room,
          "type": type,
          "id": id // pass this for radarr
        });
      }
      break;
    default:
      $("[data-group='listing']").removeClass("collapse");
      request({
        "cid": "listing",
        "request": "listing"
      }, buildListing, ajaxGenericProgress, {
        "sort": (location.hash.length > 0) ? location.hash.substring(1) : "latest"
      });
      $(".listing-sort").on("click", function() {
        request({
          "cid": "listing",
          "request": "listing"
        }, buildListing, ajaxGenericProgress, {
          "sort": $(this).attr("data-sort")
        });
      });
      $("#search").bindWithDelay("keyup", function() {
        request({
          "cid": "listing",
          "request": "listing"
        }, buildListing, ajaxGenericProgress, {
          "sort": (location.hash.length > 0) ? location.hash.substring(1) : "latest",
          "query": $(this).val()
        });
      }, 500);
      break;
  }
};

var buildListing = function(data, opts) {
  console.log("buildListing", data, opts);
  if (typeof opts == "undefined") {
    opts = {};
  }
  var sort = (typeof opts.sort == "string") ? opts.sort : "latest";
  var joined = data.sonarr.concat(data.radarr);
  switch (sort) {
    case "popularity":
      joined.sort(sortPopularity);
      break;
    case "rating":
      joined.sort(sortRating);
      break;
    case "alphabetical":
      joined.sort(sortAlphabetical);
      break;
    case "latest":
    default:
      joined.sort(sortLatest);
      break;
  }
  $("#listing").empty();
  for (var i = 0; i < joined.length; i++) {
    var blob = joined[i];
    if (typeof opts.query == "string") {
      // user entered query, check to see if blob is a match
      var searchFields = darrMakeSearchFields(blob); // concat search strings
      if (searchFields.indexOf(opts.query.toLocaleLowerCase()) == -1) {
        continue;
      }
    }
    var container = $("<div>")
      .addClass("col-6 col-sm-4 col-md-3 col-lg-2");
    $("#listing").append(container);
    if (darrIsSonarr(blob)) {
      ReactDOM.render(
        React.createElement(PosterContainer, {
          title: blob.title,
          seasons: darrGetSeasonCount(blob),
          poster: urlImage("sonarr", blob),
          link: "/t/" + blob.titleSlug
        }), container[0]
      );
    }
    else {
      ReactDOM.render(
        React.createElement(PosterContainer, {
          title: blob.title,
          seasons: -1,
          poster: urlImage("radarr", blob),
          link: "/m/" + blob.titleSlug
        }), container[0]
      );
    }
  }

  var lazyLoad = new LazyLoad({
    elements_selector: ".poster-image",
    load_delay: 500
  });
  // lazyLoad.update();
};

var buildInfo = function(data, opts) {
  switch (opts.type) {
    case "tv":
      buildInfoTv(data, opts);
      break;
    case "movie":
      buildInfoMovie(data, opts);
      break;
  }
};
var buildInfoTv = function(data, opts) {
  var blob = getBlobFromSlug(data.sonarr, opts.slug);
  $("#info-poster").css("background-image", "url({0})".format(
    urlImage("sonarr", blob)
  ));
  document.title = blob.title + " · stream";
  $("#info-title").text(blob.title);
  $("#info-title-alt").text(darrGetAlternateTitles(blob));
  $("#info-year").text(blob.year);
  $("#info-meta").html(darrMakeMetaLabels(blob));
  $("#info-genres").append(darrMakeGenreLabels(blob));
  $("#info-description").text(blob.overview);
  //$("#info-episode-guide").html(darrMakeEpisodeGuide(blob));
  $("#backdrop").css("background-image", "url({0})".format(
    urlImage("sonarr", blob, "background")
  ));

  request({
    "cid": "sonarr_{0}".format(blob.id),
    "request": "episodes",
    "id": blob.id
  }, buildInfoTvEpisodes, ajaxGenericProgress);

  console.log(blob);
};
var buildInfoMovie = function(data, opts) {
  var blob = getBlobFromSlug(data.radarr, opts.slug);
  console.log("buildInfoMovie", data, opts, blob);

  $("#info-poster").css("background-image", "url({0})".format(
    urlImage("radarr", blob)
  ));
  document.title = blob.title + " · stream";
  $("#info-title").text(blob.title);
  $("#info-title-alt").text(darrGetAlternateTitles(blob));
  $("#info-year").text(blob.year);
  $("#info-meta").html(darrMakeMetaLabels(blob));
  $("#info-genres").append(darrMakeGenreLabels(blob));
  $("#info-description").text(blob.overview);
  $("#backdrop").css("background-image", "url({0})".format(
    urlImage("radarr", blob, "background")
  ));

  buildInfoMovieEpisodes(blob);
  /*
  request({
    "cid": "radarr_{0}".format(blob.id),
    "request": "movie",
    "id": blob.id
  }, buildInfoMovieEpisodes, ajaxGenericProgress);
  */
};
var buildInfoTvEpisodes = function(data) {
  console.log(data);
  var seasonContainersActive = {};
  var seasonContainers = {};
  for (var i in data.episodes) {
    var ref = data.episodes[i];
    if (typeof seasonContainers[ref.seasonNumber] == "undefined") {
      var seasonHeader = $("<h1>")
        .text("Season {0}".format(
          ref.seasonNumber
        ))
        .addClass("col-12")
        .attr("name", "season-{0}".format(
          ref.seasonNumber
        ));
      if (ref.seasonNumber == 0) {
        seasonHeader.text("Extras");
      }
      seasonContainers[ref.seasonNumber] = $("<div>")
        .append(seasonHeader)
        .append(
          $("<div>")
            .addClass("row my-4")
        );
      seasonContainersActive[ref.seasonNumber] = false;
    }

    var episodeContainer = $("<div>")
      .addClass("episode-container col-6 col-md-4 col-lg-3 mb-4")
      .attr("data-type", "tv")
      .attr("data-series", ref.seriesId)
      .attr("data-id", ref.id); // used by tracker

    var thumb = $("<div>")
      .addClass("thumb-image mb-2")
      .attr("data-toggle", "tooltip")
      .attr("title", (typeof ref.overview == "string") ? escapeHtml(ref.overview) : "No synopsis")
      .attr("src", DEFAULT_PLACEHOLDER);
    if (ref.hasFile) {
      thumb.attr("data-src", urlThumb("sonarr", ref.id));
      seasonContainersActive[ref.seasonNumber] = true;
    }
    var thumbContainer = $("<a>")
      .addClass("thumb-container")
      .append(thumb);
    if (ref.hasFile) {
      thumbContainer
        .attr("data-logged-in-link", true)
        .attr("data-href", "/p/s/{0}".format(
          ref.id
        ));
    }

    episodeContainer
      .append(thumbContainer)
      .append(
        $("<small>")
          .addClass("episode-title ellipsis font-weight-bold")
          .attr("data-toggle", "tooltip")
          .attr("title", ref.title)
          .text(ref.title)
          // tracker placeholder
          .prepend(
            $("<i>")
              .addClass("fa fa-circle text-info mx-1 tracker")
          )
      )
      .append(
        $("<div>")
          .addClass("d-flex")
          .append(
            $("<small>")
              .addClass("episode-number text-muted mr-auto")
              .html("<span class='d-none d-md-inline'>Episode {0} &mdash; </span>{1}&times;{2}".format(
                ref.absoluteEpisodeNumber,
                ref.seasonNumber,
                ref.episodeNumber
              ))
          )
          .append(
            $("<small>")
              .addClass("episode-timing text-muted")
              .text(moment(ref.airDateUtc).fromNow())
          )
      );
    if (typeof ref.absoluteEpisodeNumber == "undefined") {
      episodeContainer.find(".episode-number").text("Special / Movie");
    }
    if (!ref.hasFile) {
      episodeContainer.find(".episode-title").prepend(
        $("<i>")
          .addClass("fa fa-close text-danger mr-2")
      ).find(".tracker").remove();
    }

    seasonContainers[ref.seasonNumber].find(".row").eq(0).append(episodeContainer);
  }
  var res = $("<div>");
  for (var i in seasonContainers) {
    if (seasonContainersActive[i]) {
      res.append(seasonContainers[i]);
    }
  }

  $("#info-episode-guide").append(res);
  $("[data-toggle='tooltip']").tooltip({
    html: true
  });
  /*
  $(".episode-container").on("click", function() {
    var id = $(this).attr("data-id");
    var type = $(this).attr("data-type");
    request({
      "cid": "sonarr_{0}{1}".format(type, id),
      "request": "episode",
      "id": id,
      "type": type
    }, ajaxGenericCallback, ajaxGenericProgress);
  });
  */
  // process #season-# if available
  if (location.hash.length > 0) {
    $([document.documentElement, document.body]).animate({
      scrollTop: $("h1[name='{0}']".format(location.hash.substring(1))).offset().top - 72
    }, 500);
  }
  var lazyLoad = new LazyLoad({
    elements_selector: ".thumb-image[data-src]",
    load_delay: 500
  });

  firebaseInitTracker(data);
};
var buildInfoMovieEpisodes = function(ref) {
  console.log("buildInfoMovieEpisodes", ref);

  var episodeContainer = $("<div>")
    .addClass("episode-container col-6 col-md-4 col-lg-3 mb-4")
    .attr("data-type", "movie")
    .attr("data-id", ref.id); // used by tracker

  var thumb = $("<div>")
    .addClass("thumb-image mb-2")
    .attr("data-src", DEFAULT_PLACEHOLDER);
  if (ref.hasFile) {
    // don't lazyload, only one 'episode'
    thumb.attr("data-src", urlThumb("radarr", ref.id));
  }
  thumb.css("background-image", "url({0})".format(
    thumb.attr("data-src")
  ));
  var thumbContainer = $("<a>")
    .addClass("thumb-container")
    .append(thumb);
  if (ref.hasFile) {
    thumbContainer
      .attr("data-logged-in-link", true)
      .attr("data-href", "/p/r/{0}".format(
        ref.id
      ));
  }

  episodeContainer
    .append(thumbContainer)
    .append(
      $("<small>")
        .addClass("episode-title ellipsis font-weight-bold")
        .text(ref.title)
    )
    .append(
      $("<div>")
        .addClass("d-flex")
        .append(
          $("<small>")
            .addClass("episode-number text-muted mr-auto")
            .html("<span class='d-none d-md-inline'>Movie")
        )
        .append(
          $("<small>")
            .addClass("episode-timing text-muted")
            .text(moment(ref.inCinemas).fromNow())
        )
    );
  if (!ref.hasFile) {
    episodeContainer.find(".episode-title").prepend(
      $("<i>")
        .addClass("fa fa-close text-danger mr-2")
    );
  }

  var res = $("<div>");
  res.append(episodeContainer);
  $("#info-episode-guide").append(res);

  firebaseInitTracker(ref);
};

var buildPlayer = function(data, opts) {
  console.log("buildPlayer", data, opts);
  var room = opts.room;
  var isSonarr = (opts.type == "sonarr") ? true : false;

  $("#player-media").empty();
  var returnLink = $("#player-nav").find("a").eq(0);

  if (isSonarr) {
    PLAYER_ACTIVE_MEDIA = data.episode.id;
    $("[data-episode-title]").html("{0} &mdash; {1}".format(
      data.episode.series.title,
      data.episode.title
    ));
    $("[data-episode-number]").html("{0} &mdash; {1}&times;{2}".format(
      (data.episode.absoluteEpisodeNumber == null) ? "Special / Movie" : "Episode " + data.episode.absoluteEpisodeNumber,
      data.episode.seasonNumber,
      data.episode.episodeNumber
    ));
    
    $("#backdrop").css("background-image", "url({0})".format(
      urlImage("sonarr", data.episode.series, "background")
    ));

    $("#player-media").attr(
      "poster", urlThumb("sonarr", data.episode.id)
    );
    $("#player-media").append(
      "<source src='{0}' type='video/mp4'></source>".format(
        escapeUrl(MEDIA_PROXY_API + data.episode.episodeFile.path)
      )
    ).append(
      "<track kind='captions' label='English Subtitles' src='{0}' srclang='en' default>".format(
        urlCaption("sonarr", data.episode.id)
      )
    );

    document.title = data.episode.series.title + " · {0}×{1} ".format(
      data.episode.seasonNumber,
      data.episode.episodeNumber
    ) + data.episode.title + " · stream";
    
    returnLink
      .append(" to <span class='text-info'>{0}</span>".format(
        data.episode.series.title
      ))
      .attr("href", "/t/{0}#season-{1}".format(
        data.episode.series.titleSlug,
        data.episode.seasonNumber
      ));
      
    $("#player-guide")
      .removeClass("collapse")
      .off("click")
      .one("click", function() {
        request({
          "cid": "sonarr_{0}".format(data.episode.series.id),
          "request": "episodes",
          "id": data.episode.series.id
        }, buildPlayerInfo, ajaxGenericProgress, {
          "episode_id": data.episode.id
        });
      })
      .on("click", function(e) {
        e.preventDefault();
        if ($("#player-log-container").is(":not(.collapse)")) {
          // swap
          $("#player-log-container").addClass("collapse");
          $("#player-guide-container").removeClass("collapse");
        }
        else {
          if ($("#player-media-container").is(".col-12")) {
            // shrink
            $("#player-media-container")
              .removeClass("col-12")
              .addClass("col-9");
            $("#player-guide-container")
              .removeClass("collapse");
            $("#player-log-container")
              .addClass("collapse");
          }
          else {
            // expand
            $("#player-media-container")
              .removeClass("col-9")
              .addClass("col-12");
            $("#player-guide-container")
              .addClass("collapse");
            $("#player-log-container")
              .addClass("collapse");
          }
        }
      });
    
    $("#player-guide").trigger("click");
  }
  else {
    data = getBlobFromId(data.radarr, opts.id);
    console.log("buildPlayer, slugged", data);
    PLAYER_ACTIVE_MEDIA = data.id;
    
    $("[data-episode-title]").html(data.title);
    $("[data-episode-number]").html("Movie");
    
    $("#backdrop").css("background-image", "url({0})".format(
      urlImage("radarr", data, "background")
    ));
    
    $("#player-media").attr(
      "poster", urlThumb("radarr", data.id)
    );
    $("#player-media").append(
      "<source src='{0}' type='video/mp4'></source>".format(
        escapeUrl(MEDIA_PROXY_API + data.path + "/" + data.movieFile.relativePath)
      )
    ); // no caption support (yet)

    document.title = data.title + " · stream";
    
    returnLink
      .append(" to <span class='text-info'>{0}</span>".format(
        data.title
      ))
      .attr("href", "/m/{0}".format(
        data.titleSlug
      ));

    $("#player-guide")
      .addClass("collapse");
  }

  if (typeof room == "string") {
    PLAYER_ACTIVE_ROOM = room;
    firebaseInitRoom(data, room, isSonarr);
    /*
    if (isSonarr) {
      firebaseInitRoom(data, room);
    }
    else {
      // radarr wip
      firebaseInitRoom(data, room);
    }
    */
  }

  plyr = new Plyr("#player-media", {
    "debug": false,
    "captions": {
      "active": true,
      "language": "auto"
    }
  });

  $("#player-log")
    .on("click", function(e) {
      e.preventDefault();
      if ($("#player-guide-container").is(":not(.collapse)")) {
        // swap
        $("#player-guide-container").addClass("collapse");
        $("#player-log-container").removeClass("collapse");
      }
      else {
        if ($("#player-media-container").is(".col-12")) {
          // shrink
          $("#player-media-container")
            .removeClass("col-12")
            .addClass("col-9");
          $("#player-guide-container")
            .addClass("collapse");
          $("#player-log-container")
            .removeClass("collapse");
        }
        else {
          // expand
          $("#player-media-container")
            .removeClass("col-9")
            .addClass("col-12");
          $("#player-guide-container")
            .addClass("collapse");
          $("#player-log-container")
            .addClass("collapse");
        }
      }
    });
  
  $("[data-toggle='tooltip']").tooltip({
    html: true
  });

  if (!isSonarr) {
    // since there's no episode guide hook for radarr, init tracker now
    firebaseInitTracker(data);
  }
};

var buildPlayerInfo = function(data, opts) {
  console.log("buildPlayerInfo", data, opts);
  $("#player-guide-container").empty();
  var seasonContainers = {};
  for (var i in data.episodes) {
    var ref = data.episodes[i];
    if (!ref.hasFile) {
      continue;
    }
    if (typeof seasonContainers[ref.seasonNumber] == "undefined") {
      seasonContainers[ref.seasonNumber] = true;
      $("#player-guide-container").append(
        $("<h5>")
          .addClass("mb-2")
          .text(
            (ref.seasonNumber > 0) ? "Season {0}".format(ref.seasonNumber) : "Extras"
          )
      ).append(
        $("<ul>")
          .addClass("mb-2")
          .addClass("list-group list-group-flush")
          .attr("data-season", ref.seasonNumber)
      );
    }
    $("#player-guide-container ul[data-season='{0}']".format(ref.seasonNumber)).append(
      $("<li>")
        .addClass("list-group-item p-3 bg-dark text-light pointer")
        .html("<small class='episode-title'>{3}<br/><div class='d-flex'><span class='text-muted d-inline-block mr-auto'>{0} &mdash; {1}&times;{2}</span><span class='text-muted d-inline-block'>{4}</span></div></small>".format(
          (ref.absoluteEpisodeNumber == null) ? "Special / Movie" : "Episode " + ref.absoluteEpisodeNumber,
          ref.seasonNumber,
          ref.episodeNumber,
          (opts.episode_id == ref.id) ? "<i class='fa fa-play text-success'></i> {0}".format(ref.title) : ref.title,
          moment(ref.airDateUtc).fromNow()
        ))
        .attr("data-logged-in-link", true)
        .attr("data-href", "/p/s/{0}".format(
          ref.id
        ))
        .attr("data-episode-num", (ref.absoluteEpisodeNumber == null) ? ref.episodeNumber : ref.absoluteEpisodeNumber) // for firebase/confirm
        .attr("data-id", ref.id) // for tracker
    );
  }
  firebaseInitTracker(data);
};

$(function() {
  initPathname();
});
