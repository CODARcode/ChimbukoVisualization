let Model = require("../web/static/js/Model");
let model = new Model();

describe('Ensuring data receiving from backend', () => {
    it('receives 10 ranks from backend', () => {
        let ranks = require('./data/frontend/10_ranks.json');
        model.update(ranks)
        expect(model.getRankIDList().length).toBe(10);
    });
});
 