let Model = require("../web/static/js/Model");
let model = new Model();

describe('Ensuring processing data to make right form of streamview data format', () => {
    it('receives 5 top and bottom dynamic rank data and statistics from backend', () => {
        
        let top = require('./data/frontend/streamview/test_1_top.json');
        let bottom = require('./data/frontend/streamview/test_1_bottom.json');
        let delta = require('./data/frontend/streamview/test_1_delta.json');

        processed = model.processStreamViewData(top, bottom, delta);
        
        expect(processed.top.x.length).toBe(5);
        expect(processed.top.y.length).toBe(5);
        expect(processed.bottom.x.length).toBe(5);
        expect(processed.bottom.y.length).toBe(5);
    });
});
 