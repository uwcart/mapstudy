//load JavaScript modules using require.js
requirejs.config({
	baseUrl: 'js/lib',
	paths: {
		mod: '../modules'
	}
});
// requirejs(['modernizr', 'jquery'])