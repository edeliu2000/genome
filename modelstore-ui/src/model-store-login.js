const React = require('react');
const ReactDOM = require("react-dom");


import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Slide from '@material-ui/core/Slide';
import Paper from '@material-ui/core/Paper';

import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import SendIcon from '@material-ui/icons/Send';
import TextField from '@material-ui/core/TextField';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';

import OktaAuth from '@okta/okta-auth-js';
import PropTypes from 'prop-types';
import { Redirect } from 'react-router-dom';
import config from './app.config'

import { withStyles } from '@material-ui/core/styles';
import { withAuth } from '@okta/okta-react';

import ModelStorePicker from './model-store-picker'

const _fetchDataRaw = require("./elastic-queries")._fetchDataRaw
const _loginQuery = require("./elastic-queries")._loginQuery


const styles = {
  appBar: {
    position: 'relative',
  },
  flex: {
    flex: 1,
  },
};


function Transition(props) {
  return <Slide direction="up" {...props} />;
}

class LoginDialog extends React.Component {

  constructor(props) {
    super(props);

    var params = window.location.hash
      && this.parseQueryString(window.location.hash.substring(1));

    var accessToken = sessionStorage.getItem("auth_state") === decodeURIComponent(params.state) ?
        params.access_token : "";

    this.state = {
      open: true,
      user: "",
      pass: "",
      sessionToken:"",
      accessToken: accessToken,
      error:"",
      authenticated: null
    };

    if(accessToken){
      sessionStorage.setItem("accessToken", accessToken);
      sessionStorage.removeItem("auth_state");
    }

    this.oktaAuth = new OktaAuth({ url: props.baseUrl });
  }


  _onChange = (event) => {
    var tmpState = {}
    tmpState[event.target.id] = event.target.value
    this.setState(tmpState)
  }

  // Parse a query string into an object
  parseQueryString = (string) => {
    if(string == "") { return {}; }
    var segments = string.split("&").map(s => s.split("=") );
    var queryString = {};
    segments.forEach(s => queryString[s[0]] = s[1]);
    return queryString;
  }

  handleLogin = () => {
    var self = this;
    _fetchDataRaw(_loginQuery(this.state.user, this.state.pass), function(data){
      if(data && data.success === "true"){
        sessionStorage.setItem('user', self.state.user)
        self.setState({open:false});
        setTimeout(function(){
          ReactDOM.render(React.createElement(ModelStorePicker), document.getElementById("datepicker-ctn"));
        }, 300);
      }
    }, "/login", true)
  };

  handleAccessToken = (baseUrl, sessionToken) => {
    var state = "id:12345,pid:123";
    var nonce = "foo";
    sessionStorage.setItem("auth_state", state);

    window.location = baseUrl
      + "oauth2/default/v1/authorize?"
      + new URLSearchParams({
        client_id:config.client_id,
        response_type: "token",
        scope:"/v1.0/genome/searchkeywords.app:*.read",
        state:state,
        nonce:nonce,
        sessionToken: sessionToken,
        redirect_uri: window.location.protocol + "//"
          + window.location.host + window.location.pathname
    });
  }

  oktaHandleSignIn= () => {
    console.log("okta sdk:", this.oktaAuth)
    this.oktaAuth
        .signIn({
          username: this.state.user,
          password: this.state.pass
        })
        .then(res => {
          console.log("getting access token...");
          this.handleAccessToken(this.props.baseUrl, res.sessionToken);
          //this.setState({
          //  sessionToken: res.sessionToken
          //});
        })
        .catch(err => {
          this.setState({ error: err.message });
          console.log(err.errorCode + ' error', err);
        });
  }

  render() {
    const { classes } = this.props;

    var accToken = sessionStorage.getItem('accessToken');
    window.location.hash = "";

    return ( this.state.accessToken || accToken ? <ModelStorePicker /> :
      <div>
        <Dialog
          fullScreen
          open={this.state.open}
          onClose={this.handleClose}
          TransitionComponent={Transition}
        >

          <AppBar color="secondary" className={classes.appBar}>
            <Toolbar>
              <IconButton onClick={this.oktaHandleSignIn} edge="start" color="inherit" aria-label="send">
                <SendIcon />
              </IconButton>
              <Typography variant="title" color="inherit" className={classes.flex}>
                Genome ModelStore
              </Typography>
            </Toolbar>
          </AppBar>


          <DialogContent>
            <Paper elevation={2}>
            <TextField
              autoFocus
              onChange={this._onChange}
              id="user"
              label="user"
              style={{marginLeft:"1.5em", marginTop: "5em"}}

            />

            <TextField
              onChange={this._onChange}
              id="pass"
              label="password"
              type="password"
              style={{marginLeft:"1.5em", marginTop: "5em"}}

            />


            <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
             width="100%" height="80%" viewBox="0 0 853.000000 1280.000000"
             preserveAspectRatio="xMidYMid meet">
            <metadata>
            Created by potrace 1.15, written by Peter Selinger 2001-2017
            </metadata>
            <g transform="translate(0.000000,1280.000000) scale(0.100000,-0.100000)"
            fill="#000000" stroke="none">
            <path d="M4863 12537 c-11 -12 -51 -98 -88 -192 -80 -201 -165 -376 -241 -494
            -66 -102 -185 -261 -195 -261 -3 0 -33 30 -65 68 -32 37 -120 135 -194 217
            -282 313 -346 390 -464 563 -74 107 -106 135 -106 93 0 -22 139 -234 221 -336
            65 -82 151 -182 339 -396 75 -85 157 -179 183 -210 l46 -55 -107 -121 c-59
            -66 -171 -193 -250 -280 -342 -382 -530 -680 -646 -1020 -130 -382 -164 -807
            -89 -1118 47 -198 133 -327 318 -477 55 -45 104 -84 108 -88 4 -4 -17 -46 -47
            -94 -244 -388 -397 -881 -413 -1326 -13 -373 57 -665 217 -907 78 -118 155
            -208 379 -447 194 -206 417 -466 448 -523 l17 -31 -86 -99 c-314 -363 -527
            -694 -687 -1071 -252 -590 -350 -1213 -254 -1602 44 -178 111 -307 358 -690
            83 -129 180 -282 215 -339 l64 -104 -23 -67 c-13 -38 -20 -73 -17 -79 10 -16
            58 -3 79 21 10 12 19 19 21 17 29 -32 218 -412 291 -586 l38 -91 49 -10 c27
            -5 48 -5 48 0 0 40 -170 439 -289 676 l-81 162 63 132 c125 263 263 499 560
            959 236 364 319 545 352 766 71 468 -129 1260 -468 1853 l-65 114 51 58 c168
            188 203 231 256 308 110 160 182 337 217 535 28 153 26 515 -4 687 -51 300
            -130 546 -256 803 -185 376 -409 655 -776 966 l-55 46 56 69 c130 160 299 314
            569 519 315 239 406 365 463 639 28 140 30 448 3 621 -24 154 -74 354 -121
            480 -78 213 -233 490 -376 672 -27 35 -49 65 -49 67 0 2 30 44 66 93 135 181
            231 356 319 583 73 189 127 341 123 346 -3 2 -14 -6 -25 -19z m-492 -1098 l22
            -31 -49 7 c-27 4 -51 9 -53 11 -7 7 41 54 50 48 4 -2 18 -18 30 -35z m-9 -103
            c66 -9 92 -17 102 -32 25 -33 127 -206 124 -209 -2 -2 -493 67 -526 74 -2 1
            33 42 79 91 92 101 79 96 221 76z m-17 -287 c168 -23 293 -46 297 -52 13 -22
            110 -268 106 -272 -4 -4 -937 130 -942 136 -5 5 51 74 141 177 47 54 59 62 82
            58 14 -3 156 -24 316 -47z m-56 -339 c267 -39 486 -72 488 -74 7 -6 47 -196
            42 -200 -8 -8 -1229 109 -1229 117 0 5 34 60 76 123 75 111 78 114 108 109 17
            -3 249 -37 515 -75z m-76 -299 c339 -32 620 -60 623 -64 3 -3 8 -58 11 -122
            l6 -118 -54 7 c-30 3 -349 33 -709 67 -360 33 -655 61 -657 62 -2 3 57 132 85
            185 18 34 28 42 50 42 15 -1 305 -27 645 -59z m-88 -311 c363 -33 675 -63 693
            -66 31 -5 32 -6 32 -53 0 -45 -26 -221 -34 -229 -6 -5 -1476 175 -1483 181 -5
            6 25 117 54 194 14 38 17 41 47 37 17 -2 328 -31 691 -64z m-70 -336 c396 -48
            724 -90 728 -94 10 -9 -65 -157 -100 -197 l-28 -31 -689 84 c-379 46 -690 85
            -692 87 -3 3 25 198 32 219 3 10 11 18 17 18 7 0 336 -39 732 -86z m-125 -310
            c349 -41 641 -78 649 -80 10 -3 5 -14 -20 -40 -27 -29 -204 -178 -255 -216 -8
            -6 -457 95 -1011 227 -22 5 -23 10 -23 95 0 65 3 90 13 90 6 0 298 -34 647
            -76z m-185 -294 c237 -55 438 -103 448 -108 16 -6 1 -23 -90 -105 -59 -53
            -115 -97 -123 -97 -8 0 -157 38 -330 83 l-314 82 -22 70 c-12 39 -25 96 -29
            129 -7 54 -6 58 11 52 11 -3 213 -50 449 -106z m-116 -300 c130 -34 251 -66
            269 -71 l33 -11 -48 -51 c-39 -42 -139 -159 -150 -176 -5 -8 -147 116 -217
            190 -68 72 -145 179 -129 179 4 0 113 -27 242 -60z m211 -588 c84 -68 117
            -100 109 -105 -15 -12 -394 -175 -398 -172 -10 11 181 345 197 345 4 0 45 -31
            92 -68z m250 -227 l64 -64 -35 -15 c-19 -8 -178 -78 -354 -156 -176 -78 -326
            -144 -332 -147 -20 -8 -15 14 25 120 l37 98 255 114 c140 62 260 114 265 114
            6 1 39 -28 75 -64z m184 -211 c36 -48 66 -90 66 -94 0 -6 -929 -364 -980 -377
            -18 -5 -18 -2 2 89 11 51 24 98 29 103 9 9 795 362 810 364 4 1 37 -38 73 -85z
            m174 -252 c29 -49 52 -93 52 -98 0 -5 -84 -37 -187 -70 -104 -34 -369 -121
            -590 -195 -221 -73 -404 -131 -407 -129 -5 5 11 170 17 176 4 4 1049 403 1057
            404 3 0 29 -40 58 -88z m145 -279 c57 -134 101 -252 96 -258 -11 -10 -1345
            -363 -1351 -357 -9 9 -34 300 -26 307 5 5 1214 412 1229 414 3 1 27 -47 52
            -106z m145 -420 c28 -116 54 -274 47 -281 -5 -5 -297 -41 -1304 -160 l-73 -9
            -14 34 c-17 40 -39 131 -33 137 3 3 1332 363 1350 365 3 1 15 -38 27 -86z m65
            -465 c4 -57 3 -128 -1 -158 l-7 -55 -575 -86 c-437 -66 -578 -84 -589 -75 -37
            29 -200 301 -188 313 5 4 1281 159 1333 162 20 1 22 -5 27 -101z m-27 -390
            c-9 -52 -20 -99 -24 -105 -9 -14 -839 -206 -852 -198 -21 13 -200 228 -194
            234 6 7 1077 169 1083 165 2 -2 -4 -45 -13 -96z m-70 -244 c-19 -56 -81 -177
            -128 -251 -29 -45 -48 -64 -71 -72 -64 -20 -306 -91 -311 -91 -3 0 -40 44 -83
            98 -42 53 -95 116 -116 140 -22 23 -38 42 -36 43 40 11 755 175 757 174 1 -1
            -4 -20 -12 -41z m-284 -461 c-16 -21 -47 -58 -69 -82 l-40 -45 -30 45 c-17 24
            -31 48 -32 53 -2 9 154 63 187 65 8 1 1 -15 -16 -36z m-87 -364 c8 -24 14 -19
            -60 -60 l-60 -34 50 58 c28 31 53 57 57 57 4 0 10 -9 13 -21z m73 -121 c43
            -70 111 -213 104 -220 -9 -8 -633 -181 -638 -176 -4 5 147 208 172 230 20 18
            325 197 336 198 3 0 15 -15 26 -32z m183 -372 c49 -115 90 -239 82 -246 -9 -7
            -992 -104 -998 -98 -7 7 122 212 136 217 92 31 710 199 727 198 19 -2 29 -15
            53 -71z m129 -365 c26 -96 59 -236 56 -238 -5 -6 -1209 17 -1214 22 -4 3 10
            38 30 78 l36 73 393 38 c217 21 446 44 509 51 186 20 178 21 190 -24z m-128
            -312 c115 -1 183 -5 192 -13 17 -13 36 -159 36 -275 l0 -83 -42 6 c-24 3 -333
            38 -688 77 -355 39 -647 73 -649 75 -4 4 36 120 64 188 l17 39 446 -7 c246 -3
            527 -7 624 -7z m-472 -369 c349 -38 650 -73 668 -75 27 -5 32 -10 32 -34 0
            -74 -60 -335 -91 -392 -10 -19 69 -37 -767 170 -332 81 -605 151 -609 154 -6
            6 2 41 39 180 l21 78 36 -5 c20 -3 322 -37 671 -76z m-264 -384 c274 -68 570
            -141 657 -162 86 -21 162 -41 168 -45 11 -7 -35 -105 -123 -261 l-49 -87 -47
            18 c-26 10 -294 112 -597 226 -302 114 -553 211 -558 215 -4 3 -1 52 8 108 8
            56 15 104 15 107 0 11 41 1 526 -119z m59 -411 c303 -114 551 -209 553 -210 3
            -2 -216 -377 -227 -388 -5 -5 -207 125 -475 308 l-466 316 0 104 0 104 33 -13
            c17 -8 280 -107 582 -221z m-135 -393 c223 -151 408 -278 413 -281 4 -4 -4
            -30 -19 -57 -15 -27 -42 -77 -60 -110 l-34 -61 -272 139 c-150 77 -279 145
            -286 151 -48 39 -202 433 -202 516 0 16 -40 42 460 -297z m260 -584 c0 -5 -26
            -66 -58 -136 -32 -70 -63 -138 -68 -151 -10 -23 -12 -21 -49 45 -21 38 -90
            156 -152 262 -63 106 -116 199 -119 206 -3 7 96 -38 220 -101 125 -63 226
            -119 226 -125z"/>
            </g>
            </svg>


          </Paper>
          </DialogContent>
          <DialogActions>
            <Button style={{marginTop: "-10.5em", marginRight:"2.5em"}} onClick={this.oktaHandleSignIn} variant="contained" color="secondary" >
              Send
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }
}


LoginDialog.propTypes = {
  classes: PropTypes.object.isRequired,
};

const LoginForm = withStyles(styles)(LoginDialog)


class Login extends React.Component {
  constructor(props) {
    super(props);
    this.state = { authenticated: false };
  }

  render() {
    if (this.state.authenticated === null) return null;
    return this.state.authenticated ?
      <ModelStorePicker /> :
      <LoginForm baseUrl={this.props.baseUrl} />;
  }
}

export default withAuth(Login);
