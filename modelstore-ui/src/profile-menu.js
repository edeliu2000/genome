const React = require('react');


import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';



class ProfileMenu extends React.Component {

  state = {
    opened: false,
    anchorEl: null
  }

  handleLogout = (event) => {
    sessionStorage.removeItem("accessToken");
    this.setState({opened:false}, ()=> {
      window.location.href = window.location.protocol + "//"
          + window.location.host + window.location.pathname;
    })
  }

  handleClick = (evt) => {
    this.setState({anchorEl: evt.currentTarget, opened:true})
  }

  handleClose = () => {
    this.setState({anchorEl: null, opened:false})
  }

  render(){
    return (
      <div style={{"float":"right", "marginRight":"2em", "marginTop":".5em"}}>
      <IconButton mini onClick={this.handleClick} aria-controls="profile-menu" aria-haspopup="true" color="primary" style={{fontSize: "1em", width:"0.8em", height:"0.8em"}}>
          <Icon style={{fontSize:"2em"}}>account_circle</Icon>
      </IconButton>
      <Menu
        id="profile-menu"
        anchorEl={this.state.anchorEl}
        open={this.state.opened}
        onClose={this.handleClose}
      >
        <MenuItem onClick={this.handleLogout}>Logout</MenuItem>
      </Menu>
      </div>

    )
  }
}


export default ProfileMenu;
