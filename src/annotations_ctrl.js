function sortChecks(a, b) {
    if (a.name < b.name)
        return -1;

    if (a.name > b.name)
        return 1;

    return 0;
}

const STATES = [{
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

export class PingdomAnnotationsQueryCtrl {

    constructor($scope)  {
        $scope.ctrl = this;

        this.annotation.checks = this.annotation.checks || [];
        this.check = null;
        this.selectable = [];
        this.states = STATES;

        this.updateSelectable();
    }

    onRemove(check) {
        const idx = this.annotation.checks.indexOf(check);

        if (idx < 0)
            return;

        this.annotation.checks.splice(idx, 1);
        this.updateSelectable();
    }

    onCheckChange() {
        if (!this.check)
            return;

        const check = this.selectable.filter(c => c.id == this.check.id).pop();
        this.annotation.checks.push(check);
        this.annotation.checks.sort(sortChecks);

        this.check = null;
        this.updateSelectable();
    }

    updateSelectable() {
        const selected = this.annotation.checks.map(c => c.id);

        return this.datasource.checkFindQuery('')
            .then(checks => checks.filter(c => selected.indexOf(c.id) < 0))
            .then(selectable => {
                this.selectable = selectable;
            });
    }

}

PingdomAnnotationsQueryCtrl.templateUrl = 'partials/annotation.editor.html';
