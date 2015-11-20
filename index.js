var $ = require('jquery');
var _ = require('underscore');
var View = require('ampersand-view');

var PrimaryView = View.extend({
    template : "",
    hogConfig: {
        data:[{
            t : d3.range(0.5, 360.5, 4),
            r : d3.range(0.5, 360.5, 4),
            color : "none",
            strokeColor : "blue",
            geometry : "LinePlot",
            name : "HOG",
        }],
        layout: {width: 500, height: 500}
    },

    fftConfig: [{
        values : [],
        key: 'FFT'
    }],

    props : {
        histogram : "object"
    },

    handleImageUpload: function(e)
    {
        var reader = new FileReader();

        reader.onload = _.bind(this.handleImageUploadFinish, this);

        reader.readAsDataURL(e.target.files[0]);
    },

    handleImageUploadFinish: function()
    {
        var img = new Image();
        img.src = event.target.result;

        this.height = img.height;
        this.width = img.width;

        this.srcCanvas.width = img.width;
        this.srcCanvas.height = img.height;

        this.tgtCanvas.width = img.width;
        this.tgtCanvas.height = img.height;

        this.srcCtx.drawImage(img,0,0);

        this.updateBlur();
    },

    updateBlur: function()
    {
        var b = this.blurSlider.val();

        $( '.blurValue' ).val(b);

        if(typeof(this.width) == "undefined")
            return;

        this.srcData = this.srcCtx.getImageData(0, 0, this.width, this.height);
        this.tgtData = this.tgtCtx.createImageData(this.width, this.height);

        var srcChannel = new Float64Array(this.srcData.data.length / 4);
        var targetChannel = new Float64Array(this.srcData.data.length / 4);

        for(var i = 0; i < this.srcData.data.length / 4; i++)
        {
            srcChannel[i] = this.srcData.data[4 * i];
        }

        gaussBlur_4(srcChannel, targetChannel, this.width, this.height, parseFloat(b));

        for(var i = 0; i < targetChannel.length; i++)
        {
            this.tgtData.data[4 * i] = targetChannel[i];
            this.tgtData.data[4 * i + 1] = targetChannel[i];
            this.tgtData.data[4 * i + 2] = targetChannel[i];
            this.tgtData.data[4 * i + 3] = 255;
        }

        this.tgtCtx.putImageData(this.tgtData, 0, 0);

        delete srcChannel;

        this.updateHOG(targetChannel);

        delete targetChannel;
    },

    updateHOG: function(image)
    {
        var fimage = new Float64Array(image.length);
        var dxs = new Float64Array(image.length);
        var dys = new Float64Array(image.length);
        var mags = new Float64Array(image.length);
        var phis = new Float64Array(image.length);

        for(var i = 0; i < image.length; i++)
        {
            fimage[i] = image[i] / 255.0;
        }

        var w = this.width;
        var h = this.height;

        for(var i = 0; i < this.height; i++)
        {
            for(var j = 0; j < this.width; j++)
            {
                if(i == 0 || (i == this.height - 1) || j == 0 || (j == this.width - 1))
                {
                    dxs[i * w + j] = 0;
                    dys[i * w + j] = 0;
                }
                else
                {
                    dxs[i * w + j] = (fimage[i * w + j + 1] - fimage[i * w + j - 1]) / 2.0;
                    dys[i * w + j] = (fimage[(i + 1) * w + j] - fimage[(i - 1) * w + j]) / 2.0;
                }
            }
        }

        for(var i = 0; i < fimage.length; i++)
        {
            mags[i] = Math.sqrt(dxs[i] * dxs[i] + dys[i] * dys[i]);

            if(mags[i] < 1e-14)
            {
                phis[i] = 0.0;
            }
            else
            {
                phis[i] = Math.atan2(dys[i], dxs[i]);

                if(phis[i] < 0.0)
                {
                    phis[i] += 2.0 * Math.PI;
                }
            }
        }

        var histogram = new Float64Array(this.hogConfig.data[0].t.length);
        var normedHistogram = new Float64Array(this.hogConfig.data[0].t.length);
        
        for(var i = 0; i < fimage.length; i++)
        {
            var idx = Math.floor(histogram.length * phis[i] / (2.0 * Math.PI + 1e-14));

            histogram[idx] += mags[i];
        }

        this.histogram = histogram;

        var sum = 0.0;
        for(var i = 0; i < histogram.length; i++)
            sum += histogram[i];

        for(var i = 0; i < histogram.length; i++)
            normedHistogram[i] = histogram[i] / sum;

        this.hogConfig.data[0].r = normedHistogram;

        micropolar.Axis().config(this.hogConfig).render(this.hogContainer);

        this.fftConfig[0].values = [];

        var data = new complex_array.ComplexArray(normedHistogram.length);

        data.map(function(value, i, n) {
            value.real = normedHistogram[i];
            value.imag = 0;
        })

        data.FFT();

        var magnitudes = new Float64Array(Math.floor((normedHistogram.length + 1) / 2));

        for(var i = 0; i < magnitudes.length; i++)
        {
            magnitudes[i] = Math.sqrt(data.real[i] * data.real[i] + data.imag[i] * data.imag[i]);
        }

        for(var i = 0; i < magnitudes.length; i++)
        {
            this.fftConfig[0].values.push({x : i, y : magnitudes[i]});
        }

        var ecube = 0.0;

        var totale = 0.0;

        var rd = data.real[4];
        var id = data.imag[4];
        var mag = Math.sqrt(rd * rd + id * id);

        rd /= mag;
        id /= mag;
        
        for(var i = 0; i < magnitudes.length; i++)
        {
            var e = magnitudes[i] * magnitudes[i];

            totale += e;

            if(i > 0 && i % 4 == 0)
            {
                var v = rd * data.real[i] + id * data.imag[i];
                ecube += v * v;
            }
        }

        $( this.el ).find( ".ecube" ).val(ecube / (totale - magnitudes[0] * magnitudes[0]));
        $( this.el ).find( ".esphere" ).val(magnitudes[0] * magnitudes[0] / totale);

        this.chart.update();
    },

    render: function()
    {
        this.renderWithTemplate();

        this.srcCanvas = $( this.el ).find('.srcCanvas').get(0);
        this.tgtCanvas = $( this.el ).find('.tgtCanvas').get(0);

        this.blurSlider = $( this.el ).find( '.blurSlider' );

        $( this.el ).find( '.blurValue' ).val(this.blurSlider.val());

        this.srcCtx = this.srcCanvas.getContext('2d');
        this.tgtCtx = this.tgtCanvas.getContext('2d');

        this.chart = nv.models.lineChart()
            .useInteractiveGuideline(true)  //We want nice looking tooltips and a guideline!
            .showLegend(true)       //Show the legend, allowing users to turn on/off line series.
            .showYAxis(true)        //Show the y-axis
            .showXAxis(true)        //Show the x-axis
            .width(500)
            .height(400)
        ;
        
        this.chart.xAxis     //Chart x-axis settings
            .axisLabel('|FFT|**2')
            .tickFormat(d3.format(',r'));
        
        this.chart.yAxis     //Chart y-axis settings
            .axisLabel('FFT bin');
        
        this.hogContainer = $( this.el ).find( '.hog' ).get(0);

        d3.select( $( this.el ).find('.fft').get(0) ).datum(this.fftConfig).call(this.chart).style({ 'height': 400 });

        $( this.el ).find( '.imageLoader' ).change(_.bind(this.handleImageUpload, this));
        this.blurSlider.on('input', _.bind(this.updateBlur, this));

        console.log(this.el);

        return this;
    }
});

var EigenvalueView = View.extend({
    initialize : function(attr, options)
    {
        View.prototype.initialize.call(this, attr, options);        

        this.view1 = attr.view1;
        this.view2 = attr.view2;
        this.view3 = attr.view3;

        this.view1.on("change:histogram", _.bind(this.updateMetrics, this));
        this.view2.on("change:histogram", _.bind(this.updateMetrics, this));
        this.view3.on("change:histogram", _.bind(this.updateMetrics, this));
    },
    updateMetrics: function(e)
    {
        var count =  0;

        if(typeof(this.view1.histogram) == "undefined") count++;
        if(typeof(this.view2.histogram) == "undefined") count++;
        if(typeof(this.view3.histogram) == "undefined") count++;

        if(count > 0)
        {
            $( this.el ).find( '.msg' ).text( "Need " + count + " more images to do the 3d analysis");
            return;
        }
        else
        {
            $( this.el ).find( '.msg' ).text("");
        }

        var histogram1 = new Float64Array(this.view1.histogram.length);
        var histogram2 = new Float64Array(this.view1.histogram.length);
        var histogram3 = new Float64Array(this.view1.histogram.length);

        for(var i = 0; i < histogram1.length; i++)
        {
            histogram1[i] = this.view1.histogram[i];
            histogram2[i] = this.view2.histogram[i];
            histogram3[i] = this.view3.histogram[i];
        }

        var dt = 2.0 * Math.PI / histogram1.length;

        var integrate = function(hist) {
            var total = 0.0;

            for(var i = 0; i < hist.length; i++)
            {
                if(i < hist.length - 1)
                {
                    total += hist[i + 1] * dt + hist[i] * dt / 2.0
                }
                else
                {
                    total += hist[0] * dt + hist[i] * dt / 2.0
                }
            }

            return total;
        }

        total = integrate(histogram1) + integrate(histogram2) + integrate(histogram3);

        for(var i = 0; i < histogram1.length; i++)
        {
            histogram1[i] /= total;
            histogram2[i] /= total;
            histogram3[i] /= total;
        }

        var thetas = new Float64Array(histogram1.length);
        var xs = new Float64Array(histogram1.length);
        var ys = new Float64Array(histogram1.length);

        for(var i = 0; i < histogram1.length; i++)
        {
            thetas[i] = i * dt + dt / 2.0;

            xs[i] = Math.cos(thetas[i]);
            ys[i] = Math.sin(thetas[i]);
        }

        var Ixx = integrate(histogram1);
        var Iyy = integrate(histogram2);
        var Izz = integrate(histogram3);

        for(var i = 0; i < histogram1.length; i++)
        {
            histogram1[i] *= -(xs[i] * ys[i]);
            histogram2[i] *= -(xs[i] * ys[i]);
            histogram3[i] *= -(xs[i] * ys[i]);
        }

        var Iyz = integrate(histogram1);
        var Ixz = integrate(histogram2);
        var Ixy = integrate(histogram3);

        var M = [[Ixx, Ixy, Ixz],
                 [Ixy, Iyy, Iyz],
                 [Ixz, Iyz, Izz]];

        result = numeric.eig(M);

        var e = result.lambda.x;

        e.sort();

        $( this.el ).find( '.e1v' ).text(e[0]);
        $( this.el ).find( '.e2v' ).text(e[1]);
        $( this.el ).find( '.e3v' ).text(e[2]);
    },

    render: function()
    {
        this.renderWithTemplate();
        return this;
    }
});

$( document ).ready(function() {
    var view1 = new PrimaryView({
        template : $( ".hogTemplate" ).text()
    });
    view1.render();
    
    var view2 = new PrimaryView({
        template : $( ".hogTemplate" ).text()
    });
    view2.render();

    var view3 = new PrimaryView({
        template : $( ".hogTemplate" ).text()
    });
    view3.render();

    var view4 = new EigenvalueView({
        template : $( ".hog3dTemplate" ).text(),
        view1 : view1,
        view2 : view2,
        view3 : view3
    });

    view4.render();
    
    $( '.view1' ).append( view1.el );
    $( '.view2' ).append( view2.el );
    $( '.view3' ).append( view3.el );
    $( '.3d' ).append( view4.el );
});
