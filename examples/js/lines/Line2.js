/**
 * Generated from 'examples/jsm/lines/Line2.js'
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('..\\LineSegments2.js'), require('..\\LineGeometry.js'), require('..\\LineMaterial.js')) :
	typeof define === 'function' && define.amd ? define(['exports', '..\\LineSegments2', '..\\LineGeometry', '..\\LineMaterial'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.THREE = global.THREE || {}, global.THREE, global.THREE, global.THREE));
}(this, (function (exports, LineSegments2_js, LineGeometry_js, LineMaterial_js) { 'use strict';

	var Line2 = function ( geometry, material ) {

		if ( geometry === undefined ) geometry = new LineGeometry_js.LineGeometry();
		if ( material === undefined ) material = new LineMaterial_js.LineMaterial( { color: Math.random() * 0xffffff } );

		LineSegments2_js.LineSegments2.call( this, geometry, material );

		this.type = 'Line2';

	};

	Line2.prototype = Object.assign( Object.create( LineSegments2_js.LineSegments2.prototype ), {

		constructor: Line2,

		isLine2: true

	} );

	exports.Line2 = Line2;

})));
