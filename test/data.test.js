let data = require("../web/static/js/Model");
let ranks = require('./data/frontend/10_ranks.json');

describe('Ensuring data receiving from backend', () => {
    it('receives 10 ranks from backend', () => {
        console.log(data);
        let dataObject = new data();
        dataObject._update(ranks)
        expect(dataObject.getRankIDList().length).toBe(10);
    });
});
 