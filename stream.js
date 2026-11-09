(function () {
  "use strict";
  var SITE = window.GK_SITE || {};
  var API_BASES = SITE.apiBases || [];
  var MATCHES_CACHE_KEY = "gk_watch_matches_cache_v1";
  var MATCHES_CACHE_TTL = 60 * 1000;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (reg) { reg.unregister(); });
    }).catch(function () { });
  }
  if (window.caches && caches.keys) {
    caches.keys().then(function (keys) {
      keys.forEach(function (key) { caches.delete(key); });
    }).catch(function () { });
  }

  var noticeEl = document.getElementById("importantNotice");
  var noticeCloseBtn = document.getElementById("noticeClose");
  if (noticeEl) {
    if (localStorage.getItem("gkNoticeClosed") === "1") noticeEl.classList.add("hidden");
    if (noticeCloseBtn) {
      noticeCloseBtn.addEventListener("click", function () {
        noticeEl.classList.add("hidden");
        localStorage.setItem("gkNoticeClosed", "1");
      });
    }
  }

  var playerFrame = document.getElementById("playerFrame");
  var channelsListEl = document.getElementById("channelsList");
  var matchTitleEl = document.getElementById("matchTitle");
  var matchStatusEl = document.getElementById("matchStatus");
  var streamStatus = document.getElementById("streamStatus");

  function formatLocalFromUnix(ms) {
    return new Date(ms).toLocaleString(undefined, {
      weekday: "short", year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true
    });
  }

  function formatCountdown(ms) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000));
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    return hours + "H " + minutes + "M " + seconds + "S";
  }

  function fetchJson(pathname) {
    var index = 0;
    function next() {
      if (index >= API_BASES.length) return Promise.reject(new Error("All match APIs failed"));
      var base = API_BASES[index++];
      return fetch(base + pathname, { headers: { Accept: "application/json" }, cache: "no-store" })
        .then(function (res) {
          if (!res.ok) throw new Error(base + " returned " + res.status);
          return res.json();
        })
        .catch(next);
    }
    return next();
  }

  function readMatchesCache() {
    try {
      var raw = sessionStorage.getItem(MATCHES_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.data)) return null;
      if (Date.now() - parsed.at > MATCHES_CACHE_TTL) return null;
      return parsed.data;
    } catch (e) { return null; }
  }

  function writeMatchesCache(data) {
    try { sessionStorage.setItem(MATCHES_CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { }
  }

  function getMatches() {
    var cached = readMatchesCache();
    if (cached) return Promise.resolve(cached);
    return fetchJson("/matches/all").then(function (data) {
      if (!Array.isArray(data)) throw new Error("Invalid matches response");
      writeMatchesCache(data);
      return data;
    });
  }

  function normalizeStreams(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.streams) && data.streams.length) return data.streams;
    return (Array.isArray(data.mainStreams) ? data.mainStreams : []).concat(
      Array.isArray(data.extraStreams) ? data.extraStreams : []
    );
  }

  function streamLabel(stream, index) {
    var quality = stream.quality || (stream.hd ? "HD" : "");
    return [
      stream.displayLabel || stream.sourceName || stream.language || ("Channel " + (index + 1)),
      quality
    ].filter(Boolean).join(" ");
  }

  function setPlayer(stream) {
    playerFrame.referrerPolicy = stream.referrerPolicy || "no-referrer-when-downgrade";
    playerFrame.src = stream.embedUrl;
  }

  var params = new URLSearchParams(window.location.search);
  var matchId = params.get("id");

  if (!matchId) {
    if (streamStatus) streamStatus.textContent = "No match ID provided. Open a match from the GKStreams schedule.";
    if (matchTitleEl) matchTitleEl.textContent = "GKStreams Live Sports Stream";
    if (matchStatusEl) matchStatusEl.textContent = "Select a match from the schedule to begin.";
  } else {
    getMatches().then(function (matches) {
      var match = matches.find(function (m) { return m.id === matchId; });
      if (!match) {
        if (streamStatus) streamStatus.textContent = "Match not found. It may have ended.";
        if (matchTitleEl) matchTitleEl.textContent = "Match not found";
        return;
      }

      var title = match.title || "Match";
      if (matchTitleEl) matchTitleEl.textContent = title;
      document.title = title + " | GKStreams";

      var start = Number(match.date);
      var end = Number(match.ends_at) || start + 150 * 60 * 1000;

      function updateStatus() {
        if (!matchStatusEl) return;
        var now = Date.now();
        if (now >= end) {
          matchStatusEl.innerHTML = '<span class="status-badge status-finished">Finished</span>';
        } else if (now >= start) {
          matchStatusEl.innerHTML = '<span class="status-badge status-running">Live</span> (Started: ' + formatLocalFromUnix(start) + ')';
        } else {
          matchStatusEl.innerHTML = 'Upcoming — Start: ' + formatLocalFromUnix(start) + '<br>⏳ ' + formatCountdown(start - now);
        }
      }

      updateStatus();
      setInterval(updateStatus, 1000);

      var sources = Array.isArray(match.sources) ? match.sources : [];
      if (!sources.length) {
        if (streamStatus) streamStatus.textContent = "No streaming sources available for this match.";
        return;
      }

      var streamPromises = sources.map(function (source) {
        return fetchJson("/stream/" + encodeURIComponent(source.source) + "/" + encodeURIComponent(source.id));
      });

      Promise.allSettled(streamPromises).then(function (results) {
        var allStreams = [];
        var seen = new Set();
        results.forEach(function (result) {
          if (result.status !== "fulfilled") return;
          normalizeStreams(result.value).forEach(function (stream) {
            if (!stream || !stream.embedUrl) return;
            var key = stream.identityKey || stream.embedUrl;
            if (seen.has(key)) return;
            seen.add(key);
            allStreams.push(stream);
          });
        });

        if (!allStreams.length) {
          sources.forEach(function (source) {
            if (!source.embedUrl) return;
            allStreams.push({
              embedUrl: source.embedUrl,
              displayLabel: source.name,
              hd: true,
              referrerPolicy: "no-referrer-when-downgrade"
            });
          });
        }

        channelsListEl.innerHTML = "";
        if (!allStreams.length) {
          if (streamStatus) streamStatus.textContent = "No streaming channels available.";
          return;
        }

        allStreams.forEach(function (stream, index) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "channel-btn";
          var label = streamLabel(stream, index);
          btn.textContent = label;
          btn.addEventListener("click", function () {
            Array.prototype.forEach.call(channelsListEl.children, function (el) {
              el.classList.remove("active");
            });
            btn.classList.add("active");
            setPlayer(stream);
            if (streamStatus) streamStatus.textContent = "Loaded " + label;
          });
          channelsListEl.appendChild(btn);
        });

        var first = allStreams[0];
        var firstLabel = streamLabel(first, 0);
        if (channelsListEl.firstChild) channelsListEl.firstChild.classList.add("active");
        setPlayer(first);
        if (streamStatus) streamStatus.textContent = "Loaded " + firstLabel;
      }).catch(function (err) {
        console.error(err);
        if (streamStatus) streamStatus.textContent = "Error loading streams.";
      });
    }).catch(function (err) {
      console.error(err);
      if (streamStatus) streamStatus.textContent = "Error loading match.";
    });
  }
})();
