let Model = require("../web/static/js/Model");
let model = new Model();

describe('Ensuring dynamic mode of HistoryView', () => {
    it('receives 15 frames from backend', () => {
        
        let historyData = require('./data/frontend/historyview/history_dynamic_1.json');
        processed = model.processHistoryViewData(historyData);
        console.log(historyData.dynamic)
        expect(processed.selected.x[0]).toBe(85);
        expect(processed.selected.x.length).toBe(15);
        expect(processed.selected.y.length).toBe(15);
    });

});

describe('Ensuring static mode of HistoryView', () => {
    it('receives 15 frames from backend', () => {
        
        let historyData = require('./data/frontend/historyview/history_static_1.json');
        processed = model.processHistoryViewData(historyData);
        
        expect(processed.selected.x[0]).toBe(0);
        expect(processed.selected.x.length).toBe(15);
        expect(processed.selected.y.length).toBe(15);
    });
});
 