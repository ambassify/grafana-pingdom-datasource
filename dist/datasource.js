'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var APP_KEY = 'kr1678azp3l9pceh0hysjnvsdmnp0exb';
var PINGDOM_MAX_LIMIT = 1000;
var PINGDOM_MAX_OFFSET = 43200;

var HOUR_MS = 3600 * 1000;
var DAY_MS = HOUR_MS * 24;
var WEEK_MS = DAY_MS * 7;
var MONTH_MS = DAY_MS * 30;

var metrics = [{
    text: 'Status',
    value: 'status'
}, {
    text: 'Response Time',
    value: 'time'
}];

var durations = [{
    name: 'seconds',
    count: 60
}, {
    name: 'minutes',
    count: 60
}, {
    name: 'hours',
    count: 24
}, {
    name: 'days'
}];

function formatDuration(time) {
    var idx = 0;
    var cur = durations[idx];

    while (cur.count && time > cur.count) {
        time = time / cur.count;
        cur = durations[++idx];
    }

    return Math.floor(time) + ' ' + cur.name;
}

var Pingdom = exports.Pingdom = function () {
    function Pingdom(instanceSettings, $q, backendSrv, templateSrv) {
        _classCallCheck(this, Pingdom);

        this.type = instanceSettings.type;
        this.url = instanceSettings.url;
        this.name = instanceSettings.name;
        this.q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.requestCache = {};

        this.headers = {
            'App-Key': APP_KEY
        };
    }

    _createClass(Pingdom, [{
        key: 'query',
        value: function query(options) {
            var _this = this;

            var targets = options.targets;

            var requests = [];

            targets.forEach(function (target) {
                var checks = _this.getChecks(target.check, options).filter(function (check) {
                    return !!check;
                }).map(function (check) {
                    return Object.assign({}, target, { check: check });
                });

                requests.push.apply(requests, _toConsumableArray(checks));
            });

            return Promise.all(requests.map(function (target) {
                var checkName = target.checkName;
                var alias = target.alias,
                    check = target.check,
                    metric = target.metric,
                    refId = target.refId;


                if (/^\$/.test(checkName)) checkName = null;

                return Promise.all([_this.getCheckResults(check, options), _this.getCheckInfo(check)]).then(function (_ref) {
                    var _ref2 = _slicedToArray(_ref, 2),
                        results = _ref2[0],
                        checkInfo = _ref2[1];

                    return {
                        target: alias || checkName || checkInfo.name || check,
                        refId: refId,
                        datapoints: results.map(function (r) {
                            return [_this.getMetric(r, metric), (r.time || r.starttime) * 1000];
                        })
                    };
                });
            })).then(function (data) {
                return { data: data };
            });
        }
    }, {
        key: 'testDatasource',
        value: function testDatasource() {
            return this.doRequest({
                url: '/settings'
            }).then(function (resp) {
                if (resp.status < 200 || resp.status >= 400) throw new Error(resp.status + ' ' + resp.statusMessage);

                return {
                    status: 'success',
                    message: 'Connected to ' + (resp.data.settings.description || resp.data.settings.company),
                    title: 'Success'
                };
            }).catch(function () {
                return { status: 'failure', message: 'Connection failed', title: 'Error' };
            });
        }
    }, {
        key: 'annotationQuery',
        value: function annotationQuery(options) {
            var _this2 = this;

            var annotation = options.annotation,
                range = options.range;
            var checks = annotation.checks,
                state = annotation.state;


            var from = range.from.unix();
            var to = range.to.unix();

            return Promise.all(checks.map(function (check) {
                return _this2.doRequest({
                    url: '/summary.outage/' + check.id + '?from=' + from + '&to=' + to
                }).then(function (res) {
                    return res.data.summary.states;
                }).catch(_this2.handleError);
            })).then(function (responses) {
                return responses.map(function (results, idx) {
                    var check = checks[idx];

                    return results.filter(function (r) {
                        return !state || r.status == state;
                    }).map(function (r) {
                        return {
                            annotation: annotation,
                            title: check.name + ' (' + check.hostname + ')',
                            time: r.timefrom * 1000,
                            text: '\nState: ' + r.status.toUpperCase() + '\nDuration: ' + formatDuration(r.timeto - r.timefrom),
                            tags: [check.name, check.type, r.status]
                        };
                    });
                });
            }).then(function (results) {
                return results.reduce(function (out, r) {
                    return out.concat(r);
                });
            });
        }
    }, {
        key: 'metricFindQuery',
        value: function metricFindQuery(search) {
            if (search == 'checks()') {
                return this.checkFindQuery().then(function (checks) {
                    return checks.map(function (c) {
                        return {
                            text: c.name,
                            value: c.name + ' - ' + c.id
                        };
                    });
                });
            }

            search = search.toLowerCase();

            if (search.length < 1) return Promise.resolve(metrics.slice());

            var found = metrics.filter(function (v) {
                var text = v.text.toLowerCase();
                var value = v.value.toLowerCase();

                return text.indexOf(search) > -1 || value.indexOf(search) > -1;
            });

            return Promise.resolve(found);
        }
    }, {
        key: 'getCheckInfo',
        value: function getCheckInfo(id) {
            return this.checkFindQuery().then(function (checks) {
                return checks.filter(function (c) {
                    return c.id == id;
                }).pop();
            });
        }
    }, {
        key: 'checkFindQuery',
        value: function checkFindQuery(search) {
            if (!this._checks) {
                this._checks = this.doRequest({ url: '/checks' }).then(function (resp) {
                    return resp.data.checks;
                }).catch(this.handleError);
            }

            if (!search) return this._checks;

            return this._checks.then(function (checks) {
                return checks.filter(function (c) {
                    return c.name.indexOf(search) > -1;
                });
            });
        }
    }, {
        key: 'replaceVariable',
        value: function replaceVariable(val, query) {
            var scopedVars = query.scopedVars;

            var tpl = this.templateSrv;

            if (!/^\$/.test(val || '')) return val;

            var name = tpl.getVariableName(val);
            var variable = tpl.index[name];

            if (scopedVars[name]) return scopedVars[name].value;

            var value = variable.current.value;

            if (tpl.isAllValue(value)) return tpl.getAllValue(variable);

            if (Array.isArray(value) && value.length > 1) return value;

            return this.templateSrv.replace(val, scopedVars);
        }
    }, {
        key: 'getChecks',
        value: function getChecks(check, query) {
            if (!check) return [];

            check = this.replaceVariable(check, query);

            if (!Array.isArray(check)) check = [check];

            return check.map(function (c) {
                return (/\d+$/.exec(c + '') || [])[0];
            });
        }
    }, {
        key: 'getMetric',
        value: function getMetric(row, metricName) {
            if (metricName == 'time') return row.responsetime || row.avgresponse;

            if (metricName == 'status') {
                if (row.status) return row.status == 'up' ? 100 : 0;

                var downtime = row.downtime,
                    unmonitored = row.unmonitored,
                    uptime = row.uptime;

                var total = downtime + unmonitored + uptime;

                if (total < 1) return 0;

                return uptime / total * 100;
            }

            return 0;
        }
    }, {
        key: 'getCheckResults',
        value: function getCheckResults(check, query) {
            var _this3 = this;

            var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
            var range = query.range,
                intervalMs = query.intervalMs;

            var from = range.from.unix();
            var to = range.to.unix();
            var period = (to - from) * 1000;

            if (!check) return Promise.resolve([]);

            var endpoint = 'summary.performance';
            var resolution = 'hour';

            // Only sub-hour results for ranges smaller than 3 days
            if (intervalMs < HOUR_MS && period < 3 * DAY_MS) {
                endpoint = 'results';
                resolution = null;
            }

            if (intervalMs < DAY_MS && period > WEEK_MS) resolution = 'day';

            if (intervalMs >= DAY_MS) resolution = 'day';

            if (intervalMs < WEEK_MS && period > 6 * MONTH_MS) resolution = 'week';

            if (intervalMs >= WEEK_MS) resolution = 'week';

            var url = '/' + endpoint + '/' + check + '?from=' + from + '&to=' + to;

            if (resolution) url += '&resolution=' + resolution + '&includeuptime=true';else url += '&limit=' + PINGDOM_MAX_LIMIT + '&offset=' + offset;

            return this.doRequest({ url: url }).then(function (res) {
                if (res.status !== 200) throw new Error(res.data.error.errormessage || res.statusText);

                var summary = res.data.summary;


                var results = res.data.results || summary.hours || summary.days || summary.weeks;

                // Summary endpoint does not allow paging
                if (resolution) return results;

                if (results.length < PINGDOM_MAX_LIMIT || offset + PINGDOM_MAX_LIMIT > PINGDOM_MAX_OFFSET) return results;

                return _this3.getCheckResults(check, query, offset + PINGDOM_MAX_LIMIT).then(function (res) {
                    return results.concat(res);
                });
            }).catch(this.handleError);
        }
    }, {
        key: 'handleError',
        value: function handleError(res) {
            if (!res.data && !res.statusText) throw res;

            if (!res.data.error) throw new Error(res.statusText);

            throw new Error(res.data.error.errormessage || res.statusText);
        }
    }, {
        key: 'doRequest',
        value: function doRequest(options) {
            var _this4 = this;

            var cacheKey = options.url.replace(/((from|to)=\d+)\d\d(&?)/gi, '$1$3');

            if (this.requestCache[cacheKey]) return this.requestCache[cacheKey];

            options.headers = Object.assign({}, this.headers, options.headers);
            options.method = options.method || 'GET';
            options.url = this.url + '/pingdom' + options.url;

            var promise = this.backendSrv.datasourceRequest(options);
            this.requestCache[cacheKey] = promise;

            setTimeout(function () {
                delete _this4.requestCache[cacheKey];
            }, 60000);

            return promise;
        }
    }]);

    return Pingdom;
}();