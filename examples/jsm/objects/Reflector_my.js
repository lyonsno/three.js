import {
	LinearFilter,
	MathUtils,
	Mesh,
	OrthographicCamera,
	PerspectiveCamera,
	RGBFormat,
	ShaderMaterial,
	UniformsUtils,
	Vector4,
	WebGLRenderTarget
} from '../../../build/three.module.js';

var Reflector = function (geometry, options, params) {

	Mesh.call( this, geometry );

	let s = this

	this.type = 'Reflector';

	var scope = this;

	options = options || {};

	var textureWidth = options.textureWidth || 512;
	var textureHeight = options.textureHeight || 512;
	var shader = options.shader || Reflector.ReflectorShader;

	// var virtualCamera = new OrthographicCamera(-50, 50, 50, -50, 1, 500);
	var virtualCamera = new PerspectiveCamera(params.fov, 1, 1, 2000);
	window.virtualCamera=virtualCamera
	this.virtualCamera=virtualCamera

	var parameters = {
		minFilter: LinearFilter,
		magFilter: LinearFilter,
		format: RGBFormat
	};

	var renderTarget = new WebGLRenderTarget( textureWidth, textureHeight, parameters );

	if ( ! MathUtils.isPowerOfTwo( textureWidth ) || ! MathUtils.isPowerOfTwo( textureHeight ) ) {

		renderTarget.texture.generateMipmaps = false;

	}

	var material = new ShaderMaterial( {
		uniforms: UniformsUtils.clone( shader.uniforms ),
		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader
	} );

	material.uniforms[ 'tDiffuse' ].value = renderTarget.texture;

	this.material = material;

	virtualCamera.position.set(0, 0, params.posZ)
	virtualCamera.lookAt(0, 0, 0)

	let bakViewport=new Vector4()

	this.onBeforeRender = function (renderer, scene, camera) {

		// Render

		renderTarget.texture.encoding = renderer.outputEncoding;

		scope.visible = false;

		var currentRenderTarget = renderer.getRenderTarget();

		renderer.setRenderTarget(renderTarget);

		renderer.getViewport(bakViewport)
		renderer.setViewport(0,window.innerHeight/2,window.innerWidth,window.innerHeight)

		renderer.state.buffers.depth.setMask( true ); // make sure the depth buffer is writable so it can be properly cleared, see #18897

		if ( renderer.autoClear === false ) renderer.clear();
		renderer.render( scene, virtualCamera );

		renderer.setRenderTarget( currentRenderTarget );

		// Restore viewport

		renderer.setViewport(
			bakViewport.x,
			bakViewport.y,
			bakViewport.z,
			bakViewport.w,
		)

		scope.visible = true;

	};

	this.getRenderTarget = function () {

		return renderTarget;

	};

};

Reflector.prototype = Object.create( Mesh.prototype );
Reflector.prototype.constructor = Reflector;

Reflector.ReflectorShader = {

	uniforms: {

		'tDiffuse': {
			value: null
		},

	},

	vertexShader: [
		'varying vec2 vUv;',

		'void main() {',

		'	vUv = uv;',

		'	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

		'}'
	].join( '\n' ),

	fragmentShader: [
		'uniform sampler2D tDiffuse;',
		'varying vec2 vUv;',

		'void main() {',

		'	vec4 base = texture2D( tDiffuse, vec2(1.-vUv.x, vUv.y+.25) );',
		'	gl_FragColor = vec4( base.rgb, 1.0 );',

		'}'
	].join( '\n' )
};

export { Reflector };
