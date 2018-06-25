var express = require('express');
var cookieParser = require('cookie-parser');
var SpotifyWebApi = require('spotify-web-api-node');

var client_id = process.env.client_id || 'CLIENT_ID_GOES_HERE';// Your client id
var client_secret = process.env.client_secret || 'CLIENT_SECRET_GOES_HERE'; // Your client secret
var redirect_uri = process.env.redirect_uri || 'https://www.DEPLOYED_APP.com/callback'; // Your redirect uri

var stateKey = 'spotify_auth_state';

var spotifyApi = new SpotifyWebApi({
  redirectUri: redirect_uri,
  clientId: client_id,
  clientSecret: client_secret
});

var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/signout', function(req, res) {

res.clearCookie('access_token');
res.clearCookie('refresh_token');
res.redirect('/');

});

app.get('/', function(req, res) {
  var access_token = req.cookies ? req.cookies['access_token'] : null;
  var refresh_token = req.cookies ? req.cookies['refresh_token'] : null;
  if (access_token && refresh_token)
  {
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token)

    spotifyApi.getMe().then(function(data) {
      res.redirect('/home/0');
    }, function(err) {
      res.render('pages/index');
    });
  }
  res.render('pages/index');
});

app.get('/error', function(req, res) {
  res.render('pages/error');
});

app.get('/playlist/:userId/:playlistId/:offset', function(req, res) {

  var access_token = req.cookies ? req.cookies['access_token'] : null;
  var refresh_token = req.cookies ? req.cookies['refresh_token'] : null;
  var userId = req.params.userId;
  var playlistId = req.params.playlistId;
  var offset = req.params.offset;

  if(access_token != null)
  {
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token)

      spotifyApi.getPlaylistTracks(userId, playlistId, {
        offset: offset
      })
      .then(
        function(data) {
          res.render('pages/playlist', {results: data.body, userId: userId, playlistId : playlistId});
        },
        function(err) {
        if(err.statusCode == 401)
        {
          refreshToken(req, res);
        }
      });
  }
  else {
    console.log('Access token null!');
    res.redirect('/');
  }
});


app.get('/reorder/:userId/:playlistId/:offset/:trackPos/:moveToPos', function(req, res) {

  var access_token = req.cookies ? req.cookies['access_token'] : null;
  var refresh_token = req.cookies ? req.cookies['refresh_token'] : null;
  var userId = req.params.userId;
  var playlistId = req.params.playlistId;
  var offset = req.params.offset;
  var trackPos = parseInt(req.params.trackPos);
  var moveToPos = parseInt(req.params.moveToPos);

  if(access_token != null)
  {
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token)

    var options = { "range_length" : 1 };
    spotifyApi.reorderTracksInPlaylist(userId, playlistId, trackPos, moveToPos, options)
      .then(function(data) {
        res.redirect('/playlist/' + userId + '/' + playlistId + '/' + offset);

      }, function(err) {
        if(err.statusCode == 401)
        {
        refreshToken(req,res);

        }
        else {
          console.log('Something went wrong!', err);
          res.redirect('/error');
        }
      });
  }
  else {
    console.log('Access token null!');
    res.redirect('/');
  }
});

// Used by client side javascript when reordering tracks using the drag handle
app.get('/api/reorder/:userId/:playlistId/:trackPos/:moveToPos', function(req, res) {

  var access_token = req.cookies ? req.cookies['access_token'] : null;
  var refresh_token = req.cookies ? req.cookies['refresh_token'] : null;
  var userId = req.params.userId;
  var playlistId = req.params.playlistId;
  var trackPos = parseInt(req.params.trackPos);
  var moveToPos = parseInt(req.params.moveToPos);

  if(access_token != null)
  {
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token)

    var options = { "range_length" : 1 };
    spotifyApi.reorderTracksInPlaylist(userId, playlistId, trackPos, moveToPos, options)
      .then(function(data) {
        res.sendStatus(200);

      }, function(err) {
        res.sendStatus(err.statusCode);
      });
  }
  else {
    console.log('Access token null!');
    res.sendStatus(401);
  }
});

app.get('/home/:offset', function(req, res) {

  var access_token = req.cookies ? req.cookies['access_token'] : null;
  var refresh_token = req.cookies ? req.cookies['refresh_token'] : null;
  var offset = req.params.offset;

  if(access_token != null)
  {
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token)

    spotifyApi.getUserPlaylists(null, {
      offset: offset
    })
    .then(function(data) {
    res.render('pages/home', {results: data.body});

    }, function(err) {
      if(err.statusCode == 401)
      {
        refreshToken(req, res);
      }
      else {
        console.log('Something went wrong!', err);
        res.redirect('/error');
      }
    });
  }
  else {
    console.log('Access token null!');
    res.redirect('/');
  }
});

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var refreshToken = function(req, res) {
  spotifyApi.refreshAccessToken().then(
    function(refreshData) {
      // Save the access token so that it's used in future calls
      res.cookie('access_token', refreshData.body['access_token'],{httpOnly: true, secure: true})
      res.redirect(req.url);
    },
    function(err) {
      console.log('Could not refresh access token', err);
      res.redirect('/');
    }
  );
}

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state,{httpOnly: true, secure: true});
  var scopes = ['user-read-private', 'playlist-read-private', 'playlist-modify-private', 'playlist-read-collaborative', 'playlist-modify-public'];

  // Create the authorization URL
  var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
  res.redirect(authorizeURL);

});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state == null || state != storedState) {
    console.log('state key mismatch: ' + state + ' ' + storedState);
    res.redirect('/error?');
  } else {
    res.clearCookie(stateKey);

    // Retrieve an access token and a refresh token
    spotifyApi.authorizationCodeGrant(code.trim()).then(
      function(data) {
        res.cookie('access_token', data.body['access_token'],{httpOnly: true, secure: true});
        res.cookie('refresh_token', data.body['refresh_token'],{httpOnly: true, secure: true});
        res.redirect('/home/0');

      },
      function(err) {
        console.log('Something went wrong!', err);
        res.redirect('/error');
        }
      );
  }

});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
