import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { withStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';

import ListSubheader from '@material-ui/core/ListSubheader';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import Collapse from '@material-ui/core/Collapse';


import Divider from '@material-ui/core/Divider';
import Badge from '@material-ui/core/Badge';
import Button from '@material-ui/core/Button';
import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';

import pink from '@material-ui/core/colors/pink';
import green from '@material-ui/core/colors/green';
import Avatar from '@material-ui/core/Avatar';
import FolderIcon from '@material-ui/icons/FolderSpecial';
import FolderOpenIcon from '@material-ui/icons/FolderOpen';
import PageviewIcon from '@material-ui/icons/Pageview';
import StarsIcon from '@material-ui/icons/Stars';
import LibraryIcon from '@material-ui/icons/LibraryBooks';


const _getInputMetaESQuery = require("./elastic-queries")._getInputMetaESQuery
const _getExtraFeatureContextESQuery = require("./elastic-queries")._getExtraFeatureContextESQuery
const _getFeatureAggregations = require("./elastic-queries")._getFeatureAggregations

const _fetchData = require("./elastic-queries")._fetchData
const _fetchDataRaw = require("./elastic-queries")._fetchDataRaw



const drawerWidth = 240;

const styles = theme => ({

  margin: {
    margin: theme.spacing.unit * 2,
  },

  appBar: {
    position: 'absolute',
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  appBarShift: {
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  'appBarShift-left': {
    marginLeft: drawerWidth,
  },
  'appBarShift-right': {
    marginRight: drawerWidth,
  },
  menuButton: {
    marginLeft: 12,
    marginRight: 20,
  },
  hide: {
    display: 'none',
  },
  drawerPaper: {
    position: 'relative',
    width: drawerWidth,
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 8px',
    ...theme.mixins.toolbar,
  },
  content: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing.unit * 3,
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  'content-left': {
    marginLeft: -drawerWidth,
  },
  'content-right': {
    marginRight: -drawerWidth,
  },
  contentShift: {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  'contentShift-left': {
    marginLeft: 0,
  },
  'contentShift-right': {
    marginRight: 0,
  },

  greenAvatar: {
    margin: 10,
    color: '#fff',
    backgroundColor: green[500],
  },

  pinkAvatar: {
    margin: 10,
    color: '#fff',
    backgroundColor: "#9575cd",
  },

  violetIcon:{
    color:"#68518f",
  },

  violetFolderDarker:{
    color:"#68518f",
    marginLeft: "-0.5rem"
  },

  violetIconDarker:{
    color:"#68518f",
    marginLeft: "0.5rem"
  },

  violetIconText:{
    fontSize:"0.4em",
  },

  avatar: {
    margin: 10,
  },

  subListItem: {
    height: "2.5em",
  },

  subListSchemaItem: {
    height: "2.2em",
    marginTop:"0.2em"
  },

  subListItemText: {
    fontSize: "0.7em !important",
  },

  subListSchemaItemText: {
    fontSize: "0.5em !important",
  },

  badge: {
    fontSize: "0.35em !important",
  },

});


class ModelNavigationDrawer extends React.Component {

  componentDidMount() {
    this.props.onRef(this)
  }


  componentWillUnmount() {
    this.props.onRef(undefined)
  }



  state = {
    open: false,
    anchor: 'left',
    titleDrawer: "fetching..",
    collapsedIndex: -1,
    collapsedJobIndex: -1,
    elements: []
  };

  handleDrawerOpen = () => {
  	this.handleGetItems()
    this.setState({ open: true });
  };

  handleDrawerClose = () => {
    this.setState({ open: false });
  };

  handleChangeAnchor = event => {
    this.setState({
      anchor: event.target.value,
    });
  };

  handleClickTenant = (i) => {
  	return () => {
      var current = i === this.state.collapsedIndex ? -1 : i
  	  this.setState({collapsedIndex: current, collapsedJobIndex:-1})
    }
  }

  handleClickJob = (j) => {
    return () => {
      var current = j === this.state.collapsedJobIndex ? -1 : j
      this.setState({collapsedJobIndex: current})
    }
  }

  handleGetItems = () => {
  	var self = this;
    _fetchDataRaw(_getFeatureAggregations(), function(resp){
    	if(resp.aggregations){
          var tenants = resp.aggregations.tenants.buckets.map(function(tenant){
            return {"name": tenant.key, subElements: tenant.names.buckets.map(function(job){ return {
              name: job.key,
              count: job.doc_count,
              subElements: job.schemas.buckets.map(function(schema){return {
                name : schema.key,
                count: schema.doc_count
              }})
            }})}
          });
          self.setState({elements: tenants, titleDrawer: "tenants"})
          console.log("tenants",tenants)
        }
    });
  }

  render() {
    const { classes, theme } = this.props;
    const { anchor, open } = this.state;

    return (


      <Drawer
        variant="persistent"
        anchor={anchor}
        open={open}
        classes={{
          paper: classes.drawerPaper,
        }}
      >
        <div className={classes.drawerHeader}>
          <Avatar className={classes.pinkAvatar}>
            <PageviewIcon />
          </Avatar>
          <Button>{this.state.titleDrawer} </Button>

        </div>
        <Divider />

        <List>
        {
          this.state.elements.map((el, i) =>
          <span>
          <ListItem button onClick={this.handleClickTenant(i)} divider>
            <ListItemIcon color="primary">
              { this.state.collapsedIndex === i ? <FolderOpenIcon className={classes.violetFolderDarker}/> : <FolderIcon className={classes.violetFolderDarker}/> }
            </ListItemIcon>
            <ListItemText inset primary={el.name} />
          </ListItem>
          <Collapse in={this.state.collapsedIndex === i} timeout="auto" unmountOnExit>
            <List component="div">
            { el.subElements.map((sub, j) =>
              <span>
              <ListItem className={classes.subListItem} button onClick={this.handleClickJob(j)} divider>
              <ListItemIcon>
              <StarsIcon className={classes.violetIcon}/>
              </ListItemIcon>
              <ListItemText className={classNames(classes.subListItemText, "sub-list-text")} primary={sub.name} />
              </ListItem>


              <Collapse in={this.state.collapsedJobIndex === j} timeout="auto" unmountOnExit>
                <List component="div">
                { sub.subElements.map((schemaEl, k) =>
                  <ListItem className={classes.subListSchemaItem} button onClick={() => this.props.handleClickDrawer(el.name + "/" + sub.name + "/" + schemaEl.name) }>
                  <ListItemIcon>
                  <Badge badgeContent={schemaEl.count} color="#401887" className={classes.violetIconText}>
                    <LibraryIcon className={classes.violetIconDarker}/>
                  </Badge>
                  </ListItemIcon>
                  <ListItemText className={classNames(classes.subListSchemaItemText, "sub-list-schema-text")} primary={schemaEl.name} />
                  </ListItem>
                  )
                }
                </List>
              </Collapse>
              </span>
              )
            }
            </List>
          </Collapse>
          </span>
          )
        }
        </List>
      </Drawer>


    );

  }

}


ModelNavigationDrawer.propTypes = {
  classes: PropTypes.object.isRequired,
  theme: PropTypes.object.isRequired,
};

export default withStyles(styles, { withTheme: true })(ModelNavigationDrawer);
