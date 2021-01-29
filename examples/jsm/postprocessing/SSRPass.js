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
} from "../../../build/three.module.js";
import { Pass } from "../postprocessing/Pass.js";
import { SSRShader, WorldNormalShader } from "../shaders/SSRShader.js";
import { CopyShader } from "../shaders/CopyShader.js";

var SSRPass = function({ scene, camera, width, height, selects, encoding, isPerspectiveCamera = true, isBouncing = false, morphTargets = false }) {

  Pass.call(this);

  this.width = (width !== undefined) ? width : 512;
  this.height = (height !== undefined) ? height : 512;

  this.clear = true;

  this.camera = camera;
  this.scene = scene;

  this.opacity = SSRShader.uniforms.opacity.value;;
  this.output = 0;

  this.maxDistance = SSRShader.uniforms.maxDistance.value;
  this.surfDist = SSRShader.uniforms.maxDistance.value;

	this.encoding = encoding

	this.cameraRotationMatrix=new THREE.Matrix4()

	this._selects = selects
  this.isSelective = Array.isArray(this._selects)
	Object.defineProperty(this, 'selects', {
		get() {
			return this._selects
		},
		set(val) {
      if (this._selects === val) return
      this._selects = val
			if (Array.isArray(val)) {
				this.isSelective = true
				this.ssrMaterial.defines.isSelective = true
				this.ssrMaterial.needsUpdate = true
			} else {
				this.isSelective = false
				this.ssrMaterial.defines.isSelective = false
				this.ssrMaterial.needsUpdate = true
			}
		}
	})

  this._outputType = 0
  Object.defineProperty(this, 'outputType', {
    get() {
      return this._outputType
    },
    set(val) {
      if (this._outputType === val) return
      this._outputType = val
      if (val) {
        this.ssrMaterial.uniforms['uOutputType'].value = val;
      } else {
        this.ssrMaterial.uniforms['uOutputType'].value = val;
      }
    }
  })

  this._isBouncing = isBouncing
  Object.defineProperty(this, 'isBouncing', {
    get() {
      return this._isBouncing
    },
    set(val) {
      if (this._isBouncing === val) return
      this._isBouncing = val
      if (val) {
        this.ssrMaterial.uniforms['tDiffuse'].value = this.prevRenderTarget.texture;
      } else {
        this.ssrMaterial.uniforms['tDiffuse'].value = this.beautyRenderTarget.texture;
      }
    }
  })

  this._isDistanceAttenuation = SSRShader.defines.isDistanceAttenuation
  Object.defineProperty(this, 'isDistanceAttenuation', {
    get() {
      return this._isDistanceAttenuation
    },
    set(val) {
      if (this._isDistanceAttenuation === val) return
      this._isDistanceAttenuation = val
      this.ssrMaterial.defines.isDistanceAttenuation = val
      this.ssrMaterial.needsUpdate = true
    }
	})


  this._isFresnel = SSRShader.defines.isFresnel
  Object.defineProperty(this, 'isFresnel', {
    get() {
      return this._isFresnel
    },
    set(val) {
      if (this._isFresnel === val) return
      this._isFresnel = val
      this.ssrMaterial.defines.isFresnel = val
      this.ssrMaterial.needsUpdate = true
    }
	})

  this._isInfiniteThick = SSRShader.defines.isInfiniteThick
  Object.defineProperty(this, 'isInfiniteThick', {
    get() {
      return this._isInfiniteThick
    },
    set(val) {
      if (this._isInfiniteThick === val) return
      this._isInfiniteThick = val
      this.ssrMaterial.defines.isInfiniteThick = val
      this.ssrMaterial.needsUpdate = true
    }
  })
  this.thickTolerance = SSRShader.uniforms.thickTolerance.value;

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

  //for bouncing
  this.prevRenderTarget = new WebGLRenderTarget(this.width, this.height, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    format: RGBAFormat,
  });

  // normal render target

  this.normalRenderTarget = new WebGLRenderTarget(this.width, this.height, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
		format: RGBAFormat,
		type: HalfFloatType,
  });

  // worldNormal render target

  this.worldNormalRenderTarget = new WebGLRenderTarget(this.width, this.height, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
		format: RGBAFormat,
		type: HalfFloatType,
	});

	this.worldNormalMaterial = new ShaderMaterial({
    defines: Object.assign({
      MAX_STEP: Math.sqrt(window.innerWidth * window.innerWidth + window.innerHeight * window.innerHeight)
    }, WorldNormalShader.defines),
    uniforms: UniformsUtils.clone(WorldNormalShader.uniforms),
    vertexShader: WorldNormalShader.vertexShader,
    fragmentShader: WorldNormalShader.fragmentShader,
    blending: NoBlending
	})

  // ssr render target

  this.ssrRenderTarget = new WebGLRenderTarget(this.width, this.height, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
		format: RGBAFormat,
		type:FloatType,
  });

  // ssr material

  if (SSRShader === undefined) {

    console.error('THREE.SSRPass: The pass relies on SSRShader.');

  }

  this.ssrMaterial = new ShaderMaterial({
    defines: Object.assign({
      MAX_STEP: Math.sqrt(window.innerWidth * window.innerWidth + window.innerHeight * window.innerHeight)
    }, SSRShader.defines),
    uniforms: UniformsUtils.clone(SSRShader.uniforms),
    vertexShader: SSRShader.vertexShader,
    fragmentShader: SSRShader.fragmentShader,
    blending: NoBlending
  });
  if (!isPerspectiveCamera) {
    this.ssrMaterial.defines.isPerspectiveCamera = isPerspectiveCamera
    this.ssrMaterial.needsUpdate = true
  }

  this.ssrMaterial.uniforms['tDiffuse'].value = this.beautyRenderTarget.texture;
  this.ssrMaterial.uniforms['tNormal'].value = this.normalRenderTarget.texture;
  this.ssrMaterial.uniforms['tDepth'].value = this.beautyRenderTarget.depthTexture;
  this.ssrMaterial.uniforms['cameraNear'].value = this.camera.near;
  this.ssrMaterial.uniforms['cameraFar'].value = this.camera.far;
  this.ssrMaterial.uniforms['surfDist'].value = this.surfDist;
  this.ssrMaterial.uniforms['resolution'].value.set(this.width, this.height);
  this.ssrMaterial.uniforms['cameraProjectionMatrix'].value.copy(this.camera.projectionMatrix);
  this.ssrMaterial.uniforms['cameraInverseProjectionMatrix'].value.copy(this.camera.projectionMatrixInverse);

  // normal material

  this.normalMaterial = new MeshNormalMaterial({ morphTargets });
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
    this.prevRenderTarget.dispose();
    this.normalRenderTarget.dispose();
    this.worldNormalRenderTarget.dispose();
    this.ssrRenderTarget.dispose();

    // dispose materials

    this.normalMaterial.dispose();
    this.copyMaterial.dispose();

    // dipsose full screen quad

    this.fsQuad.dispose();

  },

  render: function(renderer, writeBuffer /*, readBuffer, deltaTime, maskActive */ ) {

    // render beauty and depth

    if (this.encoding) this.beautyRenderTarget.texture.encoding = this.encoding
    renderer.setRenderTarget(this.beautyRenderTarget);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    // render normals

    this.renderOverride(renderer, this.normalMaterial, this.normalRenderTarget, 0, 0);

    // render SSR

    this.ssrMaterial.uniforms['opacity'].value = this.opacity;
    this.ssrMaterial.uniforms['maxDistance'].value = this.maxDistance;
    this.ssrMaterial.uniforms['surfDist'].value = this.surfDist;
    this.ssrMaterial.uniforms['thickTolerance'].value = this.thickTolerance
    this.ssrMaterial.uniforms['cameraMatrix'].value = this.camera.matrixWorld
    this.ssrMaterial.uniforms['cameraRotationMatrix'].value = this.cameraRotationMatrix.extractRotation(camera.matrixWorld)
    this.renderPass(renderer, this.ssrMaterial, this.ssrRenderTarget);

    // output result to screen

    switch (this.output) {

      case SSRPass.OUTPUT.Default:

        if (this.isBouncing) {
          this.copyMaterial.uniforms['tDiffuse'].value = this.beautyRenderTarget.texture;
          this.copyMaterial.blending = NoBlending;
          this.renderPass(renderer, this.copyMaterial, this.prevRenderTarget);

					this.copyMaterial.uniforms['tDiffuse'].value = this.ssrRenderTarget.texture;
          this.copyMaterial.blending = NormalBlending;
          this.renderPass(renderer, this.copyMaterial, this.prevRenderTarget);

          this.copyMaterial.uniforms['tDiffuse'].value = this.prevRenderTarget.texture;
          this.copyMaterial.blending = NoBlending;
          this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        } else {
          this.copyMaterial.uniforms['tDiffuse'].value = this.beautyRenderTarget.texture;
          this.copyMaterial.blending = NoBlending;
          this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);

					this.copyMaterial.uniforms['tDiffuse'].value = this.ssrRenderTarget.texture;
          this.copyMaterial.blending = NormalBlending;
          this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        }

        break;
      case SSRPass.OUTPUT.SSR:

				this.copyMaterial.uniforms['tDiffuse'].value = this.ssrRenderTarget.texture;
        this.copyMaterial.blending = NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);

        if (this.isBouncing) {
					this.copyMaterial.uniforms['tDiffuse'].value = this.beautyRenderTarget.texture;
          this.copyMaterial.blending = NoBlending;
          this.renderPass(renderer, this.copyMaterial, this.prevRenderTarget);

          this.copyMaterial.uniforms['tDiffuse'].value = this.ssrRenderTarget.texture;
          this.copyMaterial.blending = NormalBlending;
          this.renderPass(renderer, this.copyMaterial, this.prevRenderTarget);
        }

        break;

      case SSRPass.OUTPUT.Beauty:

        this.copyMaterial.uniforms['tDiffuse'].value = this.beautyRenderTarget.texture;
        this.copyMaterial.blending = NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);

        break;

      case SSRPass.OUTPUT.Normal:

        this.copyMaterial.uniforms['tDiffuse'].value = this.normalRenderTarget.texture;
        this.copyMaterial.blending = NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);

        break;

      default:
        console.warn('THREE.SSRPass: Unknown output type.');

    }

  },

  renderPass: function(renderer, passMaterial, renderTarget, clearColor, clearAlpha) {

    // save original state
    this.originalClearColor.copy(renderer.getClearColor());
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

    this.originalClearColor.copy(renderer.getClearColor());
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

  setSize: function(width, height) {

    this.width = width;
    this.height = height;

    this.ssrMaterial.defines.MAX_STEP = Math.sqrt(width * width + height * height)
    this.ssrMaterial.needsUpdate = true
    this.beautyRenderTarget.setSize(width, height);
    this.prevRenderTarget.setSize(width, height);
    this.ssrRenderTarget.setSize(width, height);
    this.normalRenderTarget.setSize(width, height);
    this.worldNormalRenderTarget.setSize(width, height);

    this.ssrMaterial.uniforms['resolution'].value.set(width, height);
    this.ssrMaterial.uniforms['cameraProjectionMatrix'].value.copy(this.camera.projectionMatrix);
    this.ssrMaterial.uniforms['cameraInverseProjectionMatrix'].value.copy(this.camera.projectionMatrixInverse);

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
