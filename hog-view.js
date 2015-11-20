var $ = require('jquery');
var _ = require('underscore');
var View = require('ampersand-view');

var HOGView = View.extend({
    template : "",
    hogConfig: {
        data:[{
            t : d3.range(1, 362, 2),
            r : d3.range(1, 362, 2),
            color : "none",
            strokeColor : "blue",
            geometry : "LinePlot",
            name : "HOG",
        }],
        layout: { width: 500, height: 500, direction: 'counterclockwise' }
    },

    hogXYConfig: [{
        values : [],
        key: 'hogxy'
    }],

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

    handleImageUploadFinish: function(event)
    {
        var img = new Image();
        img.src = event.target.result;

        this.img = img;

        img.onload = _.bind(this.handleImageLoadFinish, this);
    },

    handleImageLoadFinish: function(event)
    {
        $( this.el ).find( '.hidden' ).show();

        this.height = this.img.height;
        this.width = this.img.width;
        
        this.srcCanvas.width = this.img.width;
        this.srcCanvas.height = this.img.height;

        this.tgtCanvas.width = this.img.width;
        this.tgtCanvas.height = this.img.height;

        this.srcCtx.drawImage(this.img, 0, 0);

        this.updateBlur();
    },

    updateBlur: function()
    {
        var b = this.blurSlider.val();

        $( '.blurValue' ).val(b);

        if(typeof(this.width) == "undefined")
            return;

        if(this.width < 1 || this.height < 1)
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
                    dys[i * w + j] = -(fimage[(i + 1) * w + j] - fimage[(i - 1) * w + j]) / 2.0;
                }
            }
        }

        var maxMag = 0.0;

        for(var i = 0; i < fimage.length; i++)
        {
            mags[i] = Math.sqrt(dxs[i] * dxs[i] + dys[i] * dys[i]);

            maxMag = Math.max(mags[i], maxMag);

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

        if($( this.el ).find( '.showMags' ).prop('checked'))
        {
            for(var i = 0; i < mags.length; i++)
            {
                this.tgtData.data[4 * i + 0] = Math.round(255 * mags[i] / maxMag);
                this.tgtData.data[4 * i + 1] = Math.round(255 * mags[i] / maxMag);
                this.tgtData.data[4 * i + 2] = Math.round(255 * mags[i] / maxMag);
            }

            this.tgtCtx.putImageData(this.tgtData, 0, 0);
        }

        var histogram = new Float64Array(this.hogConfig.data[0].t.length - 1);
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

        normedHistogram[histogram.length] = histogram[0] / sum;

        this.hogConfig.data[0].r = normedHistogram;

        micropolar.Axis().config(this.hogConfig).render(this.hogContainer);

        this.hogXYConfig[0].values = [];

        for(var i = 0; i < normedHistogram.length - 1; i++)
        {
            this.hogXYConfig[0].values.push({x : this.hogConfig.data[0].t[i], y : normedHistogram[i]});
        }

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

        var esquare = 0.0;
        var elayer = 0.0;

        var totale = 0.0;

        var rd4 = data.real[4];
        var id4 = data.imag[4];
        var mag = Math.sqrt(rd4 * rd4 + id4 * id4);

        rd4 /= mag;
        id4 /= mag;

        var rd2 = data.real[2];
        var id2 = data.imag[2];
        var mag = Math.sqrt(rd2 * rd2 + id2 * id2);

        rd2 /= mag;
        id2 /= mag;
        
        for(var i = 0; i < magnitudes.length; i++)
        {
            var e = magnitudes[i] * magnitudes[i];

            totale += e;

            if(i > 0 && i % 4 == 0)
            {
                var v = rd4 * data.real[i] + id4 * data.imag[i];
                esquare += v * v;
            }

            if(i > 0 && i % 2 == 0)
            {
                var v = rd2 * data.real[i] + id2 * data.imag[i];
                elayer += v * v;
            }
        }

        $( this.el ).find( ".esquare" ).val(esquare / (totale - magnitudes[0] * magnitudes[0]));
        $( this.el ).find( ".elayer" ).val(elayer / (totale - magnitudes[0] * magnitudes[0]));
        $( this.el ).find( ".ecircle" ).val(magnitudes[0] * magnitudes[0] / totale);

        this.chart.update();
        this.chartxy.update();
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

        this.chartxy = nv.models.lineChart()
            .useInteractiveGuideline(true)  //We want nice looking tooltips and a guideline!
            .showLegend(true)       //Show the legend, allowing users to turn on/off line series.
            .showYAxis(true)        //Show the y-axis
            .showXAxis(true)        //Show the x-axis
            .width(500)
            .height(400)
        ;
        
        this.chartxy.xAxis     //Chart x-axis settings
            .axisLabel('Angle')
            .tickFormat(d3.format(',r'));
        
        this.chartxy.yAxis     //Chart y-axis settings
            .axisLabel('Bin value');
        
        d3.select( $( this.el ).find('.hogxy').get(0) ).datum(this.hogXYConfig).call(this.chartxy).style({ 'height': 400 });

        this.chart = nv.models.lineChart()
            .useInteractiveGuideline(true)  //We want nice looking tooltips and a guideline!
            .showLegend(true)       //Show the legend, allowing users to turn on/off line series.
            .showYAxis(true)        //Show the y-axis
            .showXAxis(true)        //Show the x-axis
            .width(500)
            .height(400)
        ;
        
        this.chart.xAxis     //Chart x-axis settings
            .axisLabel('FFT bin')
            .tickFormat(d3.format(',r'));
        
        this.chart.yAxis     //Chart y-axis settings
            .axisLabel('|FFT|**2');
        
        this.hogContainer = $( this.el ).find( '.hog' ).get(0);

        d3.select( $( this.el ).find('.fft').get(0) ).datum(this.fftConfig).call(this.chart).style({ 'height': 400 });

        $( this.el ).find( '.imageLoader' ).change(_.bind(this.handleImageUpload, this));
        this.blurSlider.on('input', _.bind(this.updateBlur, this));
        $( this.el ).find( '.showMags' ).change(_.bind(this.updateBlur, this));

        console.log(this.el);

        return this;
    }
});

module.exports = HOGView;
