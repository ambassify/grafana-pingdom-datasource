'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AnnotationsQueryCtrl = exports.QueryOptionsCtrl = exports.ConfigCtrl = exports.QueryCtrl = exports.Datasource = undefined;

var _datasource = require('./datasource');

var _query_ctrl = require('./query_ctrl');

var _config_ctrl = require('./config_ctrl');

var _annotations_ctrl = require('./annotations_ctrl');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PingdomQueryOptionsCtrl = function PingdomQueryOptionsCtrl() {
  _classCallCheck(this, PingdomQueryOptionsCtrl);
};

PingdomQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

exports.Datasource = _datasource.Pingdom;
exports.QueryCtrl = _query_ctrl.PingdomQueryCtrl;
exports.ConfigCtrl = _config_ctrl.PingdomConfigCtrl;
exports.QueryOptionsCtrl = PingdomQueryOptionsCtrl;
exports.AnnotationsQueryCtrl = _annotations_ctrl.PingdomAnnotationsQueryCtrl;