import {
  AddEquation,
  Color,
  NormalBlending,
  DepthTexture,
	SrcAlphaFactor,
	OneMinusSrcAlphaFactor,
  LinearFilter,
  MeshNormalMaterial,
  MeshBasicMaterial,
  NearestFilter,
  NoBlending,
  RGBAFormat,
  ShaderMaterial,
  UniformsUtils,
  UnsignedShortType,
  WebGLRenderTarget,
	HalfFloatType,
	FloatType,
	Vector3,
} from "../../../build/three.module.js";
import { Pass } from "../postprocessing/Pass.js";
import { WorldPositionShader, WorldReflectShader } from "../shaders/SSRShader.js";
import { CopyShader } from "../shaders/CopyShader.js";

var SSRPass = function({ scene, camera, width, height, encoding,}) {

  Pass.call(this);

  this.width = (width !== undefined) ? width : 512;
  this.height = (height !== undefined) ? height : 512;

  this.camera = camera;
  this.scene = scene;

  this.output = 0;

	this.encoding = encoding

	this.cameraRotationMatrix = new THREE.Matrix4()

	this.tempColor = new Color()
	this.tempVec3=new Vector3()

  // beauty render target with depth buffer

  var depthTexture = new DepthTexture();
  depthTexture.type = UnsignedShortType;
  depthTexture.minFilter = NearestFilter;
  depthTexture.maxFilter = NearestFilter;

  this.beautyRenderTarget = new WebGLRenderTarget(this.width, this.height, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    format: RGBAFormat,
    depthTexture: depthTexture,
    depthBuffer: true
  });

  // normal render target

  this.normalRenderTarget = new WebGLRenderTarget(this.width, this.height, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
		format: RGBAFormat,
		type: HalfFloatType,
  });

  // worldPosition

  this.worldPositionRenderTarget = new WebGLRenderTarget(this.width, this.height, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
		format: RGBAFormat,
		type:FloatType,
  });

  this.worldPositionMaterial = new ShaderMaterial({
    defines: Object.assign({}, WorldPositionShader.defines),
    uniforms: UniformsUtils.clone(WorldPositionShader.uniforms),
    vertexShader: WorldPositionShader.vertexShader,
    fragmentShader: WorldPositionShader.fragmentShader,
    blending: NoBlending
  });

  this.worldPositionMaterial.uniforms['tDepth'].value = this.beautyRenderTarget.depthTexture;
  this.worldPositionMaterial.uniforms['cameraNear'].value = this.camera.near;
  this.worldPositionMaterial.uniforms['cameraFar'].value = this.camera.far;
	this.worldPositionMaterial.uniforms['cameraMatrix'].value = this.camera.matrixWorld
  this.worldPositionMaterial.uniforms['cameraProjectionMatrix'].value.copy(this.camera.projectionMatrix);
  this.worldPositionMaterial.uniforms['cameraInverseProjectionMatrix'].value.copy(this.camera.projectionMatrixInverse);

  // worldReflect

  this.worldReflectRenderTarget = new WebGLRenderTarget(this.width, this.height, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
		format: RGBAFormat,
		type:FloatType,
  });

  this.worldReflectMaterial = new ShaderMaterial({
    defines: Object.assign({}, WorldReflectShader.defines),
    uniforms: UniformsUtils.clone(WorldReflectShader.uniforms),
    vertexShader: WorldReflectShader.vertexShader,
    fragmentShader: WorldReflectShader.fragmentShader,
    blending: NoBlending
  });

  this.worldReflectMaterial.uniforms['tNormal'].value = this.normalRenderTarget.texture;
	this.worldReflectMaterial.uniforms['tWorldPosition'].value = this.worldPositionRenderTarget.texture;

	// basic material

  this.basicMaterial = new MeshBasicMaterial();

  // normal material

  this.normalMaterial = new MeshNormalMaterial();
  this.normalMaterial.blending = NoBlending;

  // material for rendering the content of a render target

  this.copyMaterial = new ShaderMaterial({
    uniforms: UniformsUtils.clone(CopyShader.uniforms),
    vertexShader: CopyShader.vertexShader,
    fragmentShader: CopyShader.fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendEquation: AddEquation,
    blendSrcAlpha: SrcAlphaFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    blendEquationAlpha: AddEquation,
    // premultipliedAlpha:true,
  });

  this.fsQuad = new Pass.FullScreenQuad(null);

  this.originalClearColor = new Color();

};

SSRPass.prototype = Object.assign(Object.create(Pass.prototype), {

  constructor: SSRPass,

  dispose: function() {

    // dispose render targets

    this.beautyRenderTarget.dispose();
    this.normalRenderTarget.dispose();
    this.worldPositionRenderTarget.dispose();
    this.worldReflectRenderTarget.dispose();

    // dispose materials

    this.normalMaterial.dispose();
    this.copyMaterial.dispose();

    // dipsose full screen quad

    this.fsQuad.dispose();

  },

	render: function (renderer, writeBuffer /*, readBuffer, deltaTime, maskActive */) {

		/** !!! Don't put much calculation in render, because we'll render very much times (Scissor) in one frame !!! */
		// this.worldReflectMaterial.uniforms['uCameraPosition'].value = this.tempVec3.setFromMatrixPosition(this.camera.matrixWorld)
		// this.worldReflectMaterial.uniforms['cameraRotationMatrix'].value = this.cameraRotationMatrix.extractRotation(this.camera.matrixWorld)

    // render beauty and depth

    // if (this.encoding) this.beautyRenderTarget.texture.encoding = this.encoding
    // renderer.setRenderTarget(this.beautyRenderTarget);
    // renderer.clear();
    // renderer.render(this.scene, this.camera);

    // render basic ( only need depthTexture )

    this.renderOverride(renderer, this.basicMaterial, this.beautyRenderTarget, 0, 0);

    // render normals

    this.renderOverride(renderer, this.normalMaterial, this.normalRenderTarget, 0, 0);

    // render SSR

    this.renderPass(renderer, this.worldPositionMaterial, this.worldPositionRenderTarget);
    this.renderPass(renderer, this.worldReflectMaterial, this.worldReflectRenderTarget);

    // output result to screen
		// this.copyMaterial.uniforms['tDiffuse'].value = this.worldReflectRenderTarget.texture;
		// // this.copyMaterial.uniforms['tDiffuse'].value = this.worldPositionRenderTarget.texture;
		// this.copyMaterial.blending = NoBlending;
		// this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);

  },

  renderPass: function(renderer, passMaterial, renderTarget, clearColor, clearAlpha) {

    // save original state
    this.originalClearColor.copy(renderer.getClearColor(this.tempColor));
    var originalClearAlpha = renderer.getClearAlpha();
    var originalAutoClear = renderer.autoClear;

    renderer.setRenderTarget(renderTarget);

    // setup pass state
    renderer.autoClear = false;
    if ((clearColor !== undefined) && (clearColor !== null)) {

      renderer.setClearColor(clearColor);
      renderer.setClearAlpha(clearAlpha || 0.0);
      renderer.clear();

    }

    this.fsQuad.material = passMaterial;
    this.fsQuad.render(renderer);

    // restore original state
    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);

  },

  renderOverride: function(renderer, overrideMaterial, renderTarget, clearColor, clearAlpha) {

    this.originalClearColor.copy(renderer.getClearColor(this.tempColor));
    var originalClearAlpha = renderer.getClearAlpha();
    var originalAutoClear = renderer.autoClear;

    renderer.setRenderTarget(renderTarget);
    renderer.autoClear = false;

    clearColor = overrideMaterial.clearColor || clearColor;
    clearAlpha = overrideMaterial.clearAlpha || clearAlpha;

    if ((clearColor !== undefined) && (clearColor !== null)) {

      renderer.setClearColor(clearColor);
      renderer.setClearAlpha(clearAlpha || 0.0);
      renderer.clear();

    }

    this.scene.overrideMaterial = overrideMaterial;
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;

    // restore original state

    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);

  },

});

SSRPass.OUTPUT = {
  'Default': 0,
  'SSR': 1,
  'Beauty': 3,
  'Depth': 4,
  'Normal': 5,
};

export { SSRPass };
