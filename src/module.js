import {Pingdom} from './datasource';
import {PingdomQueryCtrl} from './query_ctrl';
import {PingdomConfigCtrl} from './config_ctrl';
import {PingdomAnnotationsQueryCtrl} from './annotations_ctrl';

class PingdomQueryOptionsCtrl {}
PingdomQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

export {
    Pingdom as Datasource,
    PingdomQueryCtrl as QueryCtrl,
    PingdomConfigCtrl as ConfigCtrl,
    PingdomQueryOptionsCtrl as QueryOptionsCtrl,
    PingdomAnnotationsQueryCtrl as AnnotationsQueryCtrl
};
