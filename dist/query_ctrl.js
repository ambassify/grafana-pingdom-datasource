'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.PingdomQueryCtrl = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _sdk = require('app/plugins/sdk');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var PingdomQueryCtrl = exports.PingdomQueryCtrl = function (_QueryCtrl) {
    _inherits(PingdomQueryCtrl, _QueryCtrl);

    function PingdomQueryCtrl($scope, $injector, uiSegmentSrv) {
        _classCallCheck(this, PingdomQueryCtrl);

        var _this = _possibleConstructorReturn(this, (PingdomQueryCtrl.__proto__ || Object.getPrototypeOf(PingdomQueryCtrl)).call(this, $scope, $injector));

        _this.scope = $scope;
        _this.uiSegmentSrv = uiSegmentSrv;

        _this.target.check = _this.target.check || '';
        _this.target.metric = _this.target.metric || 'time';

        _this.initSegments();

        Promise.all([_this.getMetricSegments(), _this.getCheckSegments()]).catch(function () {});
        return _this;
    }

    _createClass(PingdomQueryCtrl, [{
        key: 'initSegments',
        value: function initSegments() {
            this.segments = {
                metric: this.uiSegmentSrv.newSegment({ html: '-- select metric --' }),
                check: this.uiSegmentSrv.newSegment({ html: '-- select check --' })
            };
        }
    }, {
        key: 'onSegmentChange',
        value: function onSegmentChange() {
            var value = this.segments.check.value || '';
            var check = /(\$.*)|([0-9]+$)/gi.exec(value + '') || [];

            var checkId = check[1] || parseInt(check[2], 10);
            var checkName = value.replace(/:\s*\d+$/gi, '');
            var metric = this.segments.metric.value;

            if (this.target.check == checkId && this.target.metric == metric) return;

            if (!check || !metric) return;

            Object.assign(this.target, {
                check: checkId,
                checkName: checkName,
                metric: metric
            });

            this.refresh();
        }
    }, {
        key: 'getScopedVars',
        value: function getScopedVars() {
            var vars = this.datasource.templateSrv.variables;

            return vars.map(function (v) {
                return '$' + v.name;
            }).filter(function (v) {
                return !!v;
            });
        }
    }, {
        key: 'getMetricSegments',
        value: function getMetricSegments() {
            var _this2 = this;

            var query = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

            return this.datasource.metricFindQuery(query).then(function (metrics) {
                return metrics.map(function (m) {
                    return {
                        html: m.text,
                        value: m.value
                    };
                });
            }).then(function (metrics) {
                return metrics.map(function (metric) {
                    var segment = _this2.uiSegmentSrv.newSegment(metric);

                    if (!_this2.segments.metric.value && metric.value == _this2.target.metric) _this2.updateSegment('metric', segment);

                    return segment;
                });
            });
        }
    }, {
        key: 'getCheckSegments',
        value: function getCheckSegments() {
            var _this3 = this;

            var query = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

            var vars = this.getScopedVars().map(function (k) {
                return {
                    id: k,
                    value: k
                };
            });

            return this.datasource.checkFindQuery(query).then(function (checks) {
                return checks.map(function (c) {
                    return {
                        html: c.name,
                        id: c.id,
                        value: c.name + ': ' + c.id
                    };
                });
            }).then(function (checks) {
                return vars.concat(checks);
            }).then(function (checks) {
                return checks.map(function (check) {
                    var segment = _this3.uiSegmentSrv.newSegment(check);

                    if (!_this3.segments.check.value && check.id == _this3.target.check) _this3.updateSegment('check', segment);

                    return segment;
                });
            });
        }
    }, {
        key: 'updateSegment',
        value: function updateSegment(name, segment) {
            var s = this.segments[name];

            if (s.value == segment.value) return;

            s.value = segment.value;
            s.html = segment.html;

            this.onSegmentChange();
        }
    }]);

    return PingdomQueryCtrl;
}(_sdk.QueryCtrl);

PingdomQueryCtrl.templateUrl = 'partials/query.editor.html';