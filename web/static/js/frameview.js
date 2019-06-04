class FrameView extends View {
    constructor(data, svg) {
        super(data, svg, {});
        this.name = 'frameview'
        this.detailed = d3.select("#detailed_frame_info");
    }
    stream_update(){
        this.draw();
    }
    draw() {
        this.detailed.text(JSON.stringify(this.data.detailed_frame))
    }
}
