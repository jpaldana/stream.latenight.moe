// Initialize Firebase
var config = {
  apiKey: "AIzaSyDeZ8rVDrr-dFe1zhkXaSQjDy5WhZLvn38",
  authDomain: "latenight-io.firebaseapp.com",
  databaseURL: "https://latenight-io.firebaseio.com",
  projectId: "latenight-io",
  storageBucket: "latenight-io.appspot.com",
  messagingSenderId: "1029110474495"
};
firebase.initializeApp(config);

var TIMEUPDATE_BEACON_INTERVAL = 5;
var TIMEUPDATE_SYNC_ACCURACY = 20;
var TIMEUPDATE_TRACKER_INIT = false;
var CHAT_TIMEOUT = 5000;
var firebaseUser = false;
var firebaseDelayedRoomData = false;
var firebaseDelayedTrackerData = false;
var firebaseLastTimeUpdate = 0;
var firebaseIgnoreEvent = false;
var firebasePreviousMessage = false;
var player = $("#player-media")[0];
var chats = {};

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    firebaseUser = user;
    console.log("logged in", user);
    $("#auth-login").addClass("collapse");
    $("#auth-control").removeClass("collapse");
    $("[data-username]").text(
      (user.displayName == null) ? user.email : user.displayName
    );
    var picture = (user.photoURL == null) ? DEFAULT_IMAGE : user.photoURL;
    $("[data-picture]").attr("src", picture);
    $("[data-logged-in]").removeClass("collapse");
    $("[data-not-logged-in]").addClass("collapse");
    if (firebaseDelayedRoomData) {
      firebaseInitRoom(firebaseDelayedRoomData.data, firebaseDelayedRoomData.room, firebaseDelayedRoomData.isSonarr);
    }
    if (firebaseDelayedTrackerData) {
      firebaseInitTracker(firebaseDelayedTrackerData);
    }
    $("#auth-modal").modal("hide");
  }
  else {
    firebaseUser = false;
    console.log("not logged in");
    $("#auth-login").removeClass("collapse");
    $("#auth-control").addClass("collapse");
    $("[data-username]").text("login/register");
    $("[data-picture]").attr("src", DEFAULT_IMAGE);
    $("[data-logged-in]").addClass("collapse");
    $("[data-not-logged-in]").removeClass("collapse");
  }
});

var firebaseInitRoom = function(data, room, isSonarr) {
  if (!firebaseUser) {
    console.log("firebaseInitRoom", "init room but not (yet) logged in, delaying...");
    firebaseDelayedRoomData = {
      "data": data,
      "room": room,
      "isSonarr": isSonarr
    };
    return;
  }
  firebaseDelayedRoomData = false;
  console.log("firebaseInitRoom", data, room, isSonarr);

  // update room data (if host)
  if (firebaseUser.uid == room) {
    firebaseUpdateRoomMetadata(data, room, isSonarr);
    firebase.database().ref("tenants/{0}".format(
      room
    )).set({});
  }

  // update self
  var picture = (firebaseUser.photoURL == null) ? DEFAULT_IMAGE : firebaseUser.photoURL;
  firebase.database().ref("tenants/{0}/{1}".format(
    room,
    firebaseUser.uid
  )).set({
    name: $("[data-username]").eq(0).text(),
    position: 0,
    status: 1,
    photoURL: picture
  });

  firebase.database().ref("room/{0}".format(room)).on("value", function(snapshot) {
    var data = snapshot.val();
    //console.log("room ref received", data);

    // TODO check if sonarr or radarr in addition to correct ID
    if (PLAYER_ACTIVE_MEDIA !== data.active) {
      // old link / changed media id
      //console.log("Old link");
      if (PLAYER_ACTIVE_ROOM !== firebaseUser.uid) {
        //console.log("old link!", PLAYER_ACTIVE_MEDIA, data.active);
        if (confirm("The host of this room has switched to a different video. Press OK to continue or Cancel to stay on this video.")) {
          location.href = "/p/{0}/{1}/{2}".format(
            (data.sonarr) ? "s" : "r",
            data.active,
            PLAYER_ACTIVE_ROOM
          );
        }
        else {
          location.href = "/p/{0}/{1}/{2}".format(
            (data.sonarr) ? "s" : "r",
            PLAYER_ACTIVE_MEDIA,
            firebaseUser.uid
          );
        }
      }
      return;
    }

    if (Math.abs(player.currentTime - data.position) > TIMEUPDATE_SYNC_ACCURACY) {
      console.log("update self time");
      // update self time
      firebaseIgnoreEvent = true;
      player.currentTime = data.position;
    }
    if (player.paused !== data.paused) {
      console.log("toggle pause", player.paused, data.paused);
      // (un)pause
      firebaseIgnoreEvent = true;
      if (data.paused) {
        player.pause();
      }
      else {
        player.play();
        var promise = player.play();
        if (promise !== undefined) {
          promise.then(_ => {
            // normal
          }).catch(error => {
            console.log("didn't actually play?");
            // didn't actually play
            firebasePlayerEvent(99, player.currentTime);
            firebasePlayerControl(true, player.currentTime);
            firebaseRoomMessage("[no interaction]");
          });
        }
      }
    }
    firebaseIgnoreEvent = false;

    if (data.chat && data.chat.message !== firebasePreviousMessage) {
      firebasePreviousMessage = data.chat.message;
      //console.log(data.chat.sender, data.chat.message);
      // add to chat log
      if ($("#player-log-container div").length > 0 && $("#player-log-container div").eq(0).attr("data-sender") == data.chat.sender) {
        $("#player-log-container div").eq(0)
          .prepend(
            $("<small>")
              .addClass("d-block breakable text-light mb-1")
              .text(data.chat.message)
          );
      }
      else {
        var chat_container = $("<div>")
          .attr("data-sender", data.chat.sender)
          .addClass("p-2")
          .append(
            $("<small>")
              .addClass("d-block breakable text-light mb-1")
              .text(data.chat.message)
          ).append(
            $("<small>")
              .addClass("text-muted")
              .html("{0} &mdash; {1}".format(
                $("[data-tenant='{0}']".format(
                  data.chat.sender
                )).eq(0).text(),
                moment.unix(data.chat.time).format("HH:mm")
              ))
          );
        $("#player-log-container").prepend(chat_container);
      }
      // tooltip chat
      if (typeof chats[data.chat.sender] == "undefined") {
        chats[data.chat.sender] = {
          timeout: false,
          messages: []
        }
      }
      chats[data.chat.sender]["messages"].push(data.chat.message);
      if (chats[data.chat.sender]["messages"].length > 3) {
        chats[data.chat.sender]["messages"] = chats[data.chat.sender]["messages"].slice(
          chats[data.chat.sender]["messages"].length - 3
        );
      }
      clearTimeout(chats[data.chat.sender]["timeout"]);
      $("[data-tenant='{0}']".format(data.chat.sender))
        .tooltip("dispose")
        .tooltip({
          title: chats[data.chat.sender]["messages"].join("<br/>"),
          trigger: 'manual',
          html: true
        })
        .tooltip("show");
      chats[data.chat.sender]["timeout"] = setTimeout(function() {
        $("[data-tenant='{0}']".format(data.chat.sender))
          .tooltip("hide");
        chats[data.chat.sender].messages = [];
      }, CHAT_TIMEOUT);
    }
  });
  firebase.database().ref("tenants/{0}".format(room)).on("value", function(snapshot) {
    var data = snapshot.val();
    //console.log("tenants ref received", data);

    for (var uid in data) {
      var target = $("[data-tenant='{0}']".format(uid));
      var ref = data[uid];
      if (target.length < 1) {
        target = $("<div>")
          .attr("data-tenant", uid)
          .append(
            $("<div>")
              .addClass("player-tenant-image rounded-circle d-inline-block ml-2")
              .css("background-image", "url({0})".format(ref.photoURL))
          ).append(
            $("<small>")
              .addClass("ml-1")
              .text(ref.name)
          ).append(
            $("<small>")
              .addClass("ml-2 data-tenant-status")
              .html("<i class='fa fa-spin fa-spinner'></i>")
          );
        
        $("#player-tenants").append(target);
      }

      var icon = target.find(".data-tenant-status").eq(0);
      switch (ref.status) {
        case 1: // ready
          icon.html("<i class='fa fa-check text-success'></i>");
          break;
        case 2: // play/playing/timeupdate
          icon.html("<i class='fa fa-play text-info'></i>");
          break;
        case 3: // pause
          icon.html("<i class='fa fa-pause text-warning'></i>");
          break;
        case 99: // broken/[no interaction]
          icon.html("<i class='fa fa-unlink text-danger'></i>");
          break;
      }
    }
  });

  // hook chat
  $("#player-chat").on("keyup", function(e) {
    if (e.which == 13) {
      e.preventDefault();
      e.stopPropagation();
      firebaseRoomMessage($(this).val());
      $(this).val("");
      return;
    }
  });

  // TODO?
  // unhook <form>
  $("form").on("submit", function(e) {
    e.preventDefault();
    e.stopPropagation();
    return;
  });

  // hook non-host episode switch warning
  $("body").off("click", "[data-logged-in-link]").on("click", "[data-logged-in-link]", function(e) {
    if (PLAYER_ACTIVE_ROOM !== firebaseUser.uid) {
      if (!confirm("If you want to continue watching together, the host of the room must change the episode. Press OK below to continue or Cancel to stay in this room.")) {
        e.preventDefault();
        e.stopPropagation();
        firebaseRoomMessage("[wants to watch Episode {0}]".format(
          $(this).attr("data-episode-num")
        ));
        return;
      }
    }
    location.href = $(this).attr("data-href") + "/" + firebaseUser.uid;
  });

  // hook player events
  $("#player-media").on("ready", function() {
    firebasePlayerEvent(1, player.currentTime);
  });
  $("#player-media").on("play, playing", function() {
    firebasePlayerEvent(2, player.currentTime);
  });
  $("#player-media").on("play", function() {
    firebasePlayerControl(false, player.currentTime);
  });
  $("#player-media").on("pause", function() {
    firebasePlayerEvent(3, player.currentTime);
    firebasePlayerControl(true, player.currentTime);
  });
  $("#player-media").on("timeupdate", function() {
    var now = moment().unix();
    if (now - firebaseLastTimeUpdate > TIMEUPDATE_BEACON_INTERVAL) {
      firebaseLastTimeUpdate = now;
      firebasePlayerEvent(2, player.currentTime);
      if (darrIsSonarr(data)) {
        firebaseTrackEpisode(data, player.currentTime, player.duration);
      }
      else {
        firebaseTrackMovie(data, player.currentTime, player.duration);
      }
      if (PLAYER_ACTIVE_ROOM == firebaseUser.uid) {
        firebasePlayerControl(player.paused, player.currentTime);
      }
    }
  });
  $("#player-media").on("seeked", function() {
    firebasePlayerEvent(4, player.currentTime);
    firebasePlayerControl(true, player.currentTime);
  });
};
var firebaseUpdateRoomMetadata = function(data, room, isSonarr) {
  firebase.database().ref("room/{0}".format(room)).set({
    lastUpdate: moment().unix(),
    active: (isSonarr) ? data.episode.id : data.id,
    sonarr: isSonarr,
    position: 0,
    paused: true,
    chat: false
  });
};
var firebasePlayerEvent = function(a, b) {
  var picture = (firebaseUser.photoURL == null) ? DEFAULT_IMAGE : firebaseUser.photoURL;
  firebase.database().ref("tenants/{0}/{1}".format(
    PLAYER_ACTIVE_ROOM,
    firebaseUser.uid
  )).update({
    name: $("[data-username]").eq(0).text(),
    position: b,
    status: a,
    photoURL: picture
  });
};
var firebasePlayerControl = function(paused, position) {
  if (firebaseIgnoreEvent) return;
  firebase.database().ref("room/{0}".format(
    PLAYER_ACTIVE_ROOM
  )).update({
    position: position,
    paused: paused
  });
};
var firebaseRoomMessage = function(message) {
  firebase.database().ref("room/{0}".format(
    PLAYER_ACTIVE_ROOM
  )).update({
    chat: {
      message: message,
      sender: firebaseUser.uid,
      time: moment().unix()
    }
  });
};

// tracking-related calls
var firebaseInitTracker = function(data) {
  if (!firebaseUser) {
    console.log("firebaseInitTracker", "init tracker but not logged in, delaying...");
    firebaseDelayedTrackerData = data;
    return;
  }
  firebaseDelayedTrackerData = false;

  var isSonarr = darrIsSonarr(data);
  console.log("firebaseInitTracker", data, isSonarr);

  if (isSonarr) {
    var seriesId = data.episodes[0].seriesId; // pop a seriesId
    firebase.database().ref("tracker/tv/{0}/{1}".format(
      firebaseUser.uid,
      seriesId
    )).on("value", function(snapshot) {
      var data = snapshot.val();
      //console.log("tracker ref", data);
  
      for (var id in data) {
        var ref = data[id];
        var target = $("[data-id='{0}']".format(id));
        //target.find(".tracker").remove();
        if (ref.completed) {
          target.find(".tracker")
            .removeClass("fa-circle fa-hourglass text-info text-warning")
            .addClass("fa-check text-success");
        }
        else if (typeof ref.position !== "undefined" && ref.position == 0) {
          target.find(".tracker")
            .removeClass("fa-hourglass fa-check text-warning text-success")
            .addClass("fa-circle text-info");
        }
        else {
          target.find(".tracker")
            .removeClass("fa-circle fa-check text-info text-success")
            .addClass("fa-hourglass text-warning");
          if (!TIMEUPDATE_TRACKER_INIT && PLAYER_ACTIVE_ROOM == firebaseUser.uid && PLAYER_ACTIVE_MEDIA == id) {
            // resume pos
            TIMEUPDATE_TRACKER_INIT = true;
            player.currentTime = ref.position;
          }
        }
      }
    });
  }
  else {
    var movieId = data.id;
    firebase.database().ref("tracker/movie/{0}/{1}".format(
      firebaseUser.uid,
      movieId
    )).on("value", function(snapshot) {
      var ref = snapshot.val();
      //console.log("tracker ref", ref);
  
      var target = $("[data-id='{0}']".format(movieId));
      //target.find(".tracker").remove();
      if (ref.completed) {
        target.find(".tracker")
          .removeClass("fa-circle fa-hourglass text-info text-warning")
          .addClass("fa-check text-success");
      }
      else {
        target.find(".tracker")
          .removeClass("fa-circle fa-check text-info text-success")
          .addClass("fa-hourglass text-warning");
        if (!TIMEUPDATE_TRACKER_INIT && PLAYER_ACTIVE_ROOM == firebaseUser.uid) {
          // resume pos
          TIMEUPDATE_TRACKER_INIT = true;
          player.currentTime = ref.position;
        }
      }
    });
  }

  // handle clicks!
  console.log("tracker hook");
  $(".tracker").on("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    // parent should be .episode-container with [data-type] and [data-id]
    var parent = $(this).parent().parent();
    if (parent.is(".episode-container[data-type][data-id]")) {
      var isSonarr = (parent.attr("data-type") == "tv") ? true : false;
      var id = parent.attr("data-id");

      if ($(this).hasClass("text-info") || $(this).hasClass("text-warning")) {
        // new > completed
        console.log("change to complete");
        /*
        $(this)
          .removeClass("text-info fa-circle")
          .addClass("text-success fa-check");
        */
        if (isSonarr) {
          firebaseTrackEpisode({
            episode: {
              seriesId: parent.attr("data-series"),
              id: id
            }
          }, true);
        }
        else {
          firebaseTrackMovie({
            id: id,
          }, true);
        }
      }
      else if ($(this).hasClass("text-success")) {
        // completed > new
        console.log("change to new");
        /*
        $(this)
          .removeClass("text-success fa-check text-warning fa-hourglass")
          .addClass("text-info fa-circle");
        */
        if (isSonarr) {
          firebaseTrackEpisode({
            episode: {
              seriesId: parent.attr("data-series"),
              id: id
            }
          }, false);
        }
        else {
          firebaseTrackMovie({
            id: id
          }, false);
        }
      }
    }
  });

  // handle 'secret' buttons
  $("#tracker-mark-new").on("click", function() {
    if (confirm("Mark all to new?")) {
      $(".tracker.text-warning, .tracker.text-success").trigger("click");
    }
  });
  $("#tracker-mark-complete").on("click", function() {
    if (confirm("Mark all to complete?")) {
      $(".tracker.text-warning, .tracker.text-info").trigger("click");
    }
  });
};
var firebaseTrackEpisode = function(data, time, total) {
  var val = (typeof time == "boolean") ? {
    completed: time
  } : {
    position: time,
    total: total,
    completed: (total - time > 120) ? false : true,
    date: moment().unix()
  };
  firebase.database().ref("tracker/tv/{0}/{1}/{2}".format(
    firebaseUser.uid,
    data.episode.seriesId,
    data.episode.id
  )).update(val);
  console.log("update to", val);
};
var firebaseTrackMovie = function(data, time, total) {
  var val = (typeof time == "boolean") ? {
    completed: time
  } : {
    position: time,
    total: total,
    completed: (total - time > 600) ? false : true,
    date: moment().unix()
  };
  firebase.database().ref("tracker/movie/{0}/{1}".format(
    firebaseUser.uid,
    data.id
  )).update(val);
};

var firebasePictureUpdate = function(data) {
  console.log(data);
  if (typeof data.result_url !== "string") {
    firebaseGenericError("Failed to upload image.");
    return;
  }
  var url = data.result_url;
  firebaseUser.updateProfile({
    photoURL: url
  }).then(function() {
    firebaseGenericInfo("Picture updated.");
  }).catch(firebaseGenericErrorHandler);
  $("[data-picture]").attr("src", url);
};

var firebaseGenericInfo = function(error) {
  $("#auth-alert").empty();
  $("#auth-alert").append(
    $("<div>")
      .addClass("alert alert-info")
      .attr("role", "alert")
      .append(error)
  );
};
var firebaseGenericError = function(error) {
  $("#auth-alert").empty();
  $("#auth-alert").append(
    $("<div>")
      .addClass("alert alert-danger")
      .attr("role", "alert")
      .html("<i class='fa fa-close mr-2'></i> ")
      .append(error)
  );
};
var firebaseGenericErrorHandler = function(error) {
  console.log("Firebase error: ", error);

  firebaseGenericError(firebaseSimplifyError(error));
};
var firebaseSimplifyError = function(error) {
  if (typeof error.code == "string") {
    switch (error.code) {
      case "auth/user-not-found":
        return "The email address does not exist.";
      case "auth/wrong-password":
        return "Incorrect password.";
    }
  }
  if (typeof error.message == "string") {
    return error.message;
  }
  return "Unknown error.";
}

$("#auth-login-btn").on("click", function(e) {
  e.preventDefault();
  firebase.auth().signInWithEmailAndPassword(
    $("#auth-email").val(),
    $("#auth-password").val()
  ).then(function() {
    firebaseGenericInfo("Welcome back!");
    $("#auth-email").val("");
    $("#auth-password").val("");
  }).catch(firebaseGenericErrorHandler);
});
$("#auth-register-btn").on("click", function(e) {
  e.preventDefault();
  firebase.auth().createUserWithEmailAndPassword(
    $("#auth-email").val(),
    $("#auth-password").val()
  ).then(function() {
    firebaseGenericInfo("Welcome!");
    $("#auth-email").val("");
    $("#auth-password").val("");
  }).catch(firebaseGenericErrorHandler);
});
$("#auth-logout-btn").on("click", function(e) {
  if (!firebaseUser) return;
  firebase.auth().signOut().then(function() {
    firebaseGenericInfo("Good bye!");
  }).catch(firebaseGenericErrorHandler);
});
$("#auth-username").bindWithDelay("keyup", function() {
  if (!firebaseUser) return;
  var displayName = escapeHtml($(this).val());
  if (displayName.length <= 0) {
    return;
  }
  firebaseUser.updateProfile({
    displayName: displayName
  }).then(function() {
    firebaseGenericInfo("Display name updated.");
  }).catch(firebaseGenericErrorHandler);
  $("[data-username]").text(displayName);
}, 1000);
$("#auth-picture").on("change", function(e) {
  var input = e.target;
  if (input.files && input.files[0]) {
    var reader = new FileReader();
    reader.onload = function(e) {
      //console.log(e.target.result);
      request({
        "request": "picture_upload",
        "uid": firebaseUser.uid,
        "data": e.target.result
      }, firebasePictureUpdate, ajaxGenericProgress);
    };
    reader.readAsDataURL(input.files[0]);
  }
});
$("body").on("click", "[data-logged-in-link]", function(e) {
  e.preventDefault();
  if (firebaseUser) {
    location.href = $(this).attr("data-href") + "/" + firebaseUser.uid;
  }
  else {
    firebaseGenericError("You must be logged in to do this.");
    $("#auth-modal").modal("show");
  }
});
