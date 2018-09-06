var request = function(args, callback, progress, opts) {
  // if no callback is passed, use the generic handler
  if (typeof callback == "undefined") callback = ajaxGenericCallback;
  // same with progress
  if (typeof progress == "undefined") progress = ajaxGenericProgress;
  // check if cached
  if (STORAGE_SUPPORTED && (typeof args == "object" && typeof args.cid == "string")) {
    if (cacheCheck(args.cid)) {
      console.log("localStorage cache hit");
      progress(1); // emulate network completion
      if (typeof opts == "undefined") {
        callback(JSON.parse(cacheHit(args.cid)));
      }
      else {
        callback(JSON.parse(cacheHit(args.cid)), opts);
      }
      return;
    }
  }
  // bias
  var time_check = moment().unix();

  $.ajax({
    xhr: function() {
      var xhr = new window.XMLHttpRequest();

      // add upload progress listener
      //xhr.upload.addEventListener("progress", progress, false);

      // add download progress listener
      xhr.addEventListener("progress", progress, false);
      return xhr;
    },
    type: 'POST',
    url: LATENIGHT_API,
    data: args,
    success: function(data) {
      // store if cacheable
      if (STORAGE_SUPPORTED && (typeof args == "object" && typeof args.cid == "string")) {
        cacheStore(args.cid, JSON.stringify(data));
      }
      // bias
      var time_diff = Math.max(1, moment().unix() - time_check);
      var time_speed = (JSON.stringify(data).length / 1000) / time_diff;
      console.log("time taken", time_diff, "second(s); speed", time_speed, "KB/s");
      if (typeof opts == "undefined") {
        callback(data);
      }
      else {
        callback(data, opts);
      }
    }
  });
};

var ajaxGenericProgress = function(e) {
  if (e.lengthComputable) {
    var percent = e.loaded / e.total;
    console.log(percent);
  }
};
var ajaxGenericCallback = function(e) {
  console.log(e);
}

var getBlobFromSlug = function(data, titleSlug) {
  for (var i = 0; i < data.length; i++) {
    if (data[i].titleSlug == titleSlug) {
      return data[i];
    }
  }
}
var getBlobFromId = function(data, id) {
  for (var i = 0; i < data.length; i++) {
    if (data[i].id == id) {
      return data[i];
    }
  }
}

/* localStorage */
var cacheCheck = function(cid) {
  if (localStorage.getItem(cid + "_TS") !== null && localStorage.getItem(cid) !== null) {
    if (moment().unix() - parseInt(localStorage.getItem(cid + "_TS"), 10) < STORAGE_CACHEHIT_TIME) {
      return true;
    }
  }
  return false;
};
var cacheStore = function(cid, data) {
  localStorage.setItem(cid + "_TS", moment().unix());
  localStorage.setItem(cid, data);
};
var cacheHit = function(cid) {
  return localStorage.getItem(cid);
};

/* stringbuilders */
var urlImage = function(source, blob, imageType) {
  if (typeof imageType == "undefined") {
    imageType = "poster";
  }
  switch (imageType) {
    case "background":
      //return LATENIGHT_API + "?request=image&source={0}&id=".format(source) + blob.id + "&image=" + darrGetImageBackground(blob);
      return "{0}/request=image&source={1}&id={2}&image={3}/{4}".format(
        LATENIGHT_API,
        source,
        blob.id,
        darrGetImageBackground(blob),
        "background.jpg"
      );
    case "poster":
    default:
      //return LATENIGHT_API + "?request=image&source={0}&id=".format(source) + blob.id + "&image=" + darrGetImagePoster(blob);
      return "{0}/request=image&source={1}&id={2}&image={3}/{4}".format(
        LATENIGHT_API,
        source,
        blob.id,
        darrGetImagePoster(blob),
        "poster.jpg"
      );
  }
};
var urlThumb = function(source, id) {
  //return LATENIGHT_API + "?request=thumb&source={0}&id={1}".format(source, id);
  return "{0}/request=thumb&source={1}&id={2}/{3}".format(
    LATENIGHT_API,
    source,
    id,
    "thumb.jpg"
  );
};
var urlCaption = function(source, id) {
  // TODO
  return "https://dev6-api.latenight.moe/twilight/Subtitle.php?host={0}&id={1}".format(source, id);
};

var sortLatest = function(a, b) {
  var aa = (typeof a.previousAiring == "string") ? a.previousAiring : (typeof a.firstAired == "string") ? a.firstAired : (typeof a.inCinemas == "string") ? a.inCinemas : "";
  var bb = (typeof b.previousAiring == "string") ? b.previousAiring : (typeof b.firstAired == "string") ? b.firstAired : (typeof a.inCinemas == "string") ? a.inCinemas : "";
  return bb.localeCompare(aa);
};
var sortAlphabetical = function(a, b) {
  var aa = a.sortTitle;
  var bb = b.sortTitle;
  return aa.localeCompare(bb);
};
var sortRating = function(a, b) {
  var aa = a.ratings.value;
  var bb = b.ratings.value;
  return bb - aa;
};
var sortPopularity = function(a, b) {
  var aa = a.ratings.votes;
  var bb = b.ratings.votes;
  return bb - aa;
};
