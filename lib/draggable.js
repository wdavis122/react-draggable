'use strict';

var React = require('react');
var emptyFunction = function(){};
var assign = require('object-assign');
var classNames = require('classnames');

//
// Helpers. See Element definition below this section.
//

function createUIEvent(draggable) {
  // State changes are often (but not always!) async. We want the latest value.
  var state = draggable._pendingState || draggable.state;
  return {
    node: draggable.getDOMNode(),
    position: {
      top: state.clientY,
      left: state.clientX
    }
  };
}

function canDragY(draggable) {
  return draggable.props.axis === 'both' ||
      draggable.props.axis === 'y';
}

function canDragX(draggable) {
  return draggable.props.axis === 'both' ||
      draggable.props.axis === 'x';
}

function isFunction(func) {
  return typeof func === 'function' || Object.prototype.toString.call(func) === '[object Function]';
}

// @credits https://gist.github.com/rogozhnikoff/a43cfed27c41e4e68cdc
function findInArray(array, callback) {
  for (var i = 0, length = array.length; i < length; i++) {
    if (callback.apply(callback, [array[i], i, array])) return array[i];
  }
}

function matchesSelector(el, selector) {
  var method = findInArray([
    'matches',
    'webkitMatchesSelector',
    'mozMatchesSelector',
    'msMatchesSelector',
    'oMatchesSelector'
  ], function(method){
    return isFunction(el[method]);
  });

  return el[method].call(el, selector);
}

// @credits: http://stackoverflow.com/questions/4817029/whats-the-best-way-to-detect-a-touch-screen-device-using-javascript/4819886#4819886
/* Conditional to fix node server side rendering of component */
if (typeof window === 'undefined') {
    // Do Node Stuff
    var isTouchDevice = false;
} else {
    // Do Browser Stuff
    var isTouchDevice = 'ontouchstart' in window || // works on most browsers
                        'onmsgesturechange' in window; // works on ie10 on ms surface

}

// look ::handleDragStart
//function isMultiTouch(e) {
//  return e.touches && Array.isArray(e.touches) && e.touches.length > 1
//}

/**
 * simple abstraction for dragging events names
 * */
var dragEventFor = (function () {
  var eventsFor = {
    touch: {
      start: 'touchstart',
      move: 'touchmove',
      end: 'touchend'
    },
    mouse: {
      start: 'mousedown',
      move: 'mousemove',
      end: 'mouseup'
    }
  };
  return eventsFor[isTouchDevice ? 'touch' : 'mouse'];
})();

/**
 * get {clientX, clientY} positions of control
 * */
function getControlPosition(e) {
  var position = (e.touches && e.touches[0]) || e;
  return {
    clientX: position.clientX,
    clientY: position.clientY
  };
}

function addEvent(el, event, handler) {
  if (!el) { return; }
  if (el.attachEvent) {
    el.attachEvent('on' + event, handler);
  } else if (el.addEventListener) {
    el.addEventListener(event, handler, true);
  } else {
    el['on' + event] = handler;
  }
}

function removeEvent(el, event, handler) {
  if (!el) { return; }
  if (el.detachEvent) {
    el.detachEvent('on' + event, handler);
  } else if (el.removeEventListener) {
    el.removeEventListener(event, handler, true);
  } else {
    el['on' + event] = null;
  }
}

function snapToGrid(grid, pendingX, pendingY) {
  var x = Math.round(pendingX / grid[0]) * grid[0];
  var y = Math.round(pendingY / grid[1]) * grid[1];
  return [x, y];
}

// Useful for preventing blue highlights all over everything when dragging.
var userSelectStyle = ';user-select: none;-webkit-user-select:none;-moz-user-select:none;' +
  '-o-user-select:none;-ms-user-select:none;';

function createCSSTransform(style) {
  if (!style.x && !style.y) return {};
  // Replace unitless items with px
  var x = style.x + 'px';
  var y = style.y + 'px';
  return {
    transform: 'translate(' + x + ',' + y + ')',
    WebkitTransform: 'translate(' + x + ',' + y + ')',
    OTransform: 'translate(' + x + ',' + y + ')',
    msTransform: 'translate(' + x + ',' + y + ')',
    MozTransform: 'translate(' + x + ',' + y + ')'
  };
}


//
// End Helpers.
//

//
// Define <Draggable>
//

module.exports = React.createClass({
  displayName: 'Draggable',

  propTypes: {
    /**
     * `axis` determines which axis the draggable can move.
     *
     * 'both' allows movement horizontally and vertically.
     * 'x' limits movement to horizontal axis.
     * 'y' limits movement to vertical axis.
     *
     * Defaults to 'both'.
     */
    axis: React.PropTypes.oneOf(['both', 'x', 'y']),

    /**
     * By default, we add 'user-select:none' attributes to the document body
     * to prevent ugly text selection during drag. If this is causing problems
     * for your app, set this to `false`.
     */
    enableUserSelectHack: React.PropTypes.bool,

    /**
     * `handle` specifies a selector to be used as the handle that initiates drag.
     *
     * Example:
     *
     * ```jsx
     *   var App = React.createClass({
     *       render: function () {
     *         return (
     *            <Draggable handle=".handle">
     *              <div>
     *                  <div className="handle">Click me to drag</div>
     *                  <div>This is some other content</div>
     *              </div>
     *           </Draggable>
     *         );
     *       }
     *   });
     * ```
     */
    handle: React.PropTypes.string,

    /**
     * `cancel` specifies a selector to be used to prevent drag initialization.
     *
     * Example:
     *
     * ```jsx
     *   var App = React.createClass({
     *       render: function () {
     *           return(
     *               <Draggable cancel=".cancel">
     *                   <div>
     *                     <div className="cancel">You can't drag from here</div>
     *            <div>Dragging here works fine</div>
     *                   </div>
     *               </Draggable>
     *           );
     *       }
     *   });
     * ```
     */
    cancel: React.PropTypes.string,

    /**
     * `grid` specifies the x and y that dragging should snap to.
     *
     * Example:
     *
     * ```jsx
     *   var App = React.createClass({
     *       render: function () {
     *           return (
     *               <Draggable grid={[25, 25]}>
     *                   <div>I snap to a 25 x 25 grid</div>
     *               </Draggable>
     *           );
     *       }
     *   });
     * ```
     */
    grid: React.PropTypes.arrayOf(React.PropTypes.number),

    /**
     * `zIndex` specifies the zIndex to use while dragging.
     *
     * Example:
     *
     * ```jsx
     *   var App = React.createClass({
     *       render: function () {
     *           return (
     *               <Draggable zIndex={100}>
     *                   <div>I have a zIndex</div>
     *               </Draggable>
     *           );
     *       }
     *   });
     * ```
     */
    zIndex: React.PropTypes.number,

    /**
     * Called when dragging starts.
     *
     * Example:
     *
     * ```js
     *  function (event, ui) {}
     * ```
     *
     * `event` is the Event that was triggered.
     * `ui` is an object:
     *
     * ```js
     *  {
     *    position: {top: 0, left: 0}
     *  }
     * ```
     */
    onStart: React.PropTypes.func,

    /**
     * Called while dragging.
     *
     * Example:
     *
     * ```js
     *  function (event, ui) {}
     * ```
     *
     * `event` is the Event that was triggered.
     * `ui` is an object:
     *
     * ```js
     *  {
     *    position: {top: 0, left: 0}
     *  }
     * ```
     */
    onDrag: React.PropTypes.func,

    /**
     * Called when dragging stops.
     *
     * Example:
     *
     * ```js
     *  function (event, ui) {}
     * ```
     *
     * `event` is the Event that was triggered.
     * `ui` is an object:
     *
     * ```js
     *  {
     *    position: {top: 0, left: 0}
     *  }
     * ```
     */
    onStop: React.PropTypes.func,

    /**
     * A workaround option which can be passed if onMouseDown needs to be accessed,
     * since it'll always be blocked (due to that there's internal use of onMouseDown)
     */
    onMouseDown: React.PropTypes.func,
  },

  componentWillUnmount: function() {
    // Remove any leftover event handlers
    removeEvent(window, dragEventFor['move'], this.handleDrag);
    removeEvent(window, dragEventFor['end'], this.handleDragEnd);
  },

  getDefaultProps: function () {
    return {
      axis: 'both',
      handle: null,
      cancel: null,
      grid: null,
      zIndex: NaN,
      enableUserSelectHack: true,
      onStart: emptyFunction,
      onDrag: emptyFunction,
      onStop: emptyFunction,
      onMouseDown: emptyFunction
    };
  },

  getInitialState: function () {
    return {
      // Whether or not we are currently dragging.
      dragging: false,

      // Offset between start top/left and mouse top/left while dragging.
      offsetX: 0, offsetY: 0,

      // Current transform x and y.
      clientX: 0, clientY: 0
    };
  },

  handleDragStart: function (e) {
    // todo: write right implementation to prevent multitouch drag
    // prevent multi-touch events
    // if (isMultiTouch(e)) {
    //     this.handleDragEnd.apply(e, arguments);
    //     return
    // }

    // Make it possible to attach event handlers on top of this one
    this.props.onMouseDown(e);

    // Short circuit if handle or cancel prop was provided and selector doesn't match
    if ((this.props.handle && !matchesSelector(e.target, this.props.handle)) ||
      (this.props.cancel && matchesSelector(e.target, this.props.cancel))) {
      return;
    }

    // Add a style to the body to disable user-select. This prevents text from
    // being selected all over the page.
    if (this.props.enableUserSelectHack) {
      var style = document.body.getAttribute('style') || '';
      document.body.setAttribute('style', style + userSelectStyle);
    }

    var dragPoint = getControlPosition(e);

    // Initiate dragging. Set the current x and y as offsets
    // so we know how much we've moved during the drag. This allows us
    // to drag elements around even if they have been moved, without issue.
    this.setState({
      dragging: true,
      offsetX: dragPoint.clientX - this.state.clientX,
      offsetY: dragPoint.clientY - this.state.clientY
    });

    // Call event handler
    this.props.onStart(e, createUIEvent(this));

    // Add event handlers
    addEvent(window, dragEventFor['move'], this.handleDrag);
    addEvent(window, dragEventFor['end'], this.handleDragEnd);
  },

  handleDragEnd: function (e) {
    // Short circuit if not currently dragging
    if (!this.state.dragging) {
      return;
    }

    // Remove user-select styles.
    if (this.props.enableUserSelectHack) {
      var style = document.body.getAttribute('style') || '';
      document.body.setAttribute('style', style.replace(userSelectStyle, ''));
    }

    // Turn off dragging
    this.setState({
      dragging: false
    });

    // Call event handler
    this.props.onStop(e, createUIEvent(this));

    // Remove event handlers
    removeEvent(window, dragEventFor['move'], this.handleDrag);
    removeEvent(window, dragEventFor['end'], this.handleDragEnd);
  },

  handleDrag: function (e) {
    var dragPoint = getControlPosition(e);

    // Calculate X and Y
    var clientX = dragPoint.clientX - this.state.offsetX;
    var clientY = dragPoint.clientY - this.state.offsetY;

    // Snap to grid if prop has been provided
    if (Array.isArray(this.props.grid)) {
      var coords = snapToGrid(this.props.grid, clientX, clientY);
      clientX = coords[0], clientY = coords[1];
    }

    // Update transform
    this.setState({
      clientX: clientX,
      clientY: clientY
    });

    // Call event handler
    this.props.onDrag(e, createUIEvent(this));
  },

  render: function () {
    // Create style object. We extend from existing styles so we don't
    // remove anything already set (like background, color, etc).
    var childStyle = this.props.children.props.style || {};

    // Add a CSS transform to move the element around. This allows us to move the element around
    // without worrying about whether or not it is relatively or absolutely positioned.
    // If the item you are dragging already has a transform set, wrap it in a <span> so <Draggable>
    // has a clean slate.
    var transform = createCSSTransform({
      // Set left if horizontal drag is enabled
      x: canDragX(this) ?
        this.state.clientX :
        0,

      // Set top if vertical drag is enabled
      y: canDragY(this) ?
        this.state.clientY :
        0
    });
    var style = assign({}, childStyle, transform);

    // Set zIndex if currently dragging and prop has been provided
    if (this.state.dragging && !isNaN(this.props.zIndex)) {
      style.zIndex = this.props.zIndex;
    }

    var className = classNames((this.props.children.props.className || ''), 'react-draggable', {
      'react-draggable-dragging': this.state.dragging,
      'react-draggable-dragged': this.state.dragged
    });

    // Reuse the child provided
    // This makes it flexible to use whatever element is wanted (div, ul, etc)
    return React.cloneElement(React.Children.only(this.props.children), {
      style: style,
      className: className,

      onMouseDown: this.handleDragStart,
      onTouchStart: function(ev){
        ev.preventDefault(); // prevent for scroll
        return this.handleDragStart.apply(this, arguments);
      }.bind(this),

      onMouseUp: this.handleDragEnd,
      onTouchEnd: this.handleDragEnd
    });
  }
});
