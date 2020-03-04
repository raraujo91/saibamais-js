import zoid from 'zoid';

window.SaibaMais = zoid.create({
  tag: "svg-saibamais-paypal",

  url: `./saibamais.html`,

  autoResize: {
    height: true, 
    width: false
  },

  dimensions: {
    height: "100%",
    width: "100%"
  }
});
