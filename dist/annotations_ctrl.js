'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.PingdomAnnotationsQueryCtrl = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _sdk = require('app/plugins/sdk');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function sortChecks(a, b) {
    if (a.name < b.name) return -1;

    if (a.name > b.name) return 1;

    return 0;
}

var STATES = [{
    id: '',
    name: 'All'
}, {
    id: 'up',
    name: 'Up'
}, {
    id: 'down',
    name: 'Down'
}, {
    id: 'unknown',
    name: 'Unknown'
}];

var PingdomAnnotationsQueryCtrl = exports.PingdomAnnotationsQueryCtrl = function () {
    function PingdomAnnotationsQueryCtrl($scope) {
        _classCallCheck(this, PingdomAnnotationsQueryCtrl);

        $scope.ctrl = this;

        this.annotation.checks = this.annotation.checks || [];
        this.check = null;
        this.selectable = [];
        this.states = STATES;

        this.updateSelectable();
    }

    _createClass(PingdomAnnotationsQueryCtrl, [{
        key: 'onRemove',
        value: function onRemove(check) {
            var idx = this.annotation.checks.indexOf(check);

            if (idx < 0) return;

            this.annotation.checks.splice(idx, 1);
            this.updateSelectable();
        }
    }, {
        key: 'onCheckChange',
        value: function onCheckChange() {
            var _this = this;

            if (!this.check) return;

            var check = this.selectable.filter(function (c) {
                return c.id == _this.check.id;
            }).pop();
            this.annotation.checks.push(check);
            this.annotation.checks.sort(sortChecks);

            this.check = null;
            this.updateSelectable();
        }
    }, {
        key: 'updateSelectable',
        value: function updateSelectable() {
            var _this2 = this;

            var selected = this.annotation.checks.map(function (c) {
                return c.id;
            });

            return this.datasource.checkFindQuery('').then(function (checks) {
                return checks.filter(function (c) {
                    return selected.indexOf(c.id) < 0;
                });
            }).then(function (selectable) {
                _this2.selectable = selectable;
            });
        }
    }]);

    return PingdomAnnotationsQueryCtrl;
}();

PingdomAnnotationsQueryCtrl.templateUrl = 'partials/annotation.editor.html';