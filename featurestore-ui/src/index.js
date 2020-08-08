const React = require('react');
const ReactDOM = require("react-dom");

import Login from './model-store-login'
import config from './app.config'

//now initialize the main element
ReactDOM.render(<Login baseUrl={config.url} />, document.getElementById("datepicker-ctn"));
