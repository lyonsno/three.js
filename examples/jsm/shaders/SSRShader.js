import {
  Matrix4,
  Vector2
} from "../../../build/three.module.js";
/**
 * References:
 * https://lettier.github.io/3d-game-shaders-for-beginners/screen-space-reflection.html
 */

var SSRShader = {

  defines: {
    MAX_STEP: 0,
    isPerspectiveCamera: true,
    isDistanceAttenuation: true,
    isFresnel: true,
    isInfiniteThick: false,
    isSelective: false,
  },

  uniforms: {

    "uOutputType": { value: 0 },
    "tDiffuse": { value: null },
    "tNormal": { value: null },
    "tMetalness": { value: null },
    "tDepth": { value: null },
    "cameraNear": { value: null },
    "cameraFar": { value: null },
    "cameraMatrix": { value: null },
    "cameraRotationMatrix": { value: null },
    "resolution": { value: new Vector2() },
    "cameraProjectionMatrix": { value: new Matrix4() },
    "cameraInverseProjectionMatrix": { value: new Matrix4() },
    "opacity": { value: .5 },
    "maxDistance": { value: 180 },
    "cameraRange": { value: 0 },
    "surfDist": { value: .007 },
    "thickTolerance": { value: .03 },

  },

  vertexShader: /* glsl */`

    varying vec2 vUv;

    void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    }

  `,

  fragmentShader: /* glsl */`
		// precision highp float;
		precision highp sampler2D;
		varying vec2 vUv;
		uniform float uOutputType;
		uniform sampler2D tDepth;
		uniform sampler2D tNormal;
		uniform sampler2D tMetalness;
		uniform sampler2D tDiffuse;
		uniform float cameraRange;
		uniform vec2 resolution;
		uniform float opacity;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraMatrix;
		uniform mat4 cameraRotationMatrix;
		uniform float maxDistance;
		uniform float surfDist;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraInverseProjectionMatrix;
		uniform float thickTolerance;
		#include <packing>
		float pointToLineDistance(vec3 x0, vec3 x1, vec3 x2) {
			//x0: point, x1: linePointA, x2: linePointB
			//https://mathworld.wolfram.com/Point-LineDistance3-Dimensional.html
			return length(cross(x0-x1,x0-x2))/length(x2-x1);
		}
		float pointPlaneDistance(vec3 point,vec3 planePoint,vec3 planeNormal){
			// https://mathworld.wolfram.com/Point-PlaneDistance.html
			//// https://en.wikipedia.org/wiki/Plane_(geometry)
			//// http://paulbourke.net/geometry/pointlineplane/
			float a=planeNormal.x,b=planeNormal.y,c=planeNormal.z;
			float x0=point.x,y0=point.y,z0=point.z;
			float x=planePoint.x,y=planePoint.y,z=planePoint.z;
			float d=-(a*x+b*y+c*z);
			float distance=(a*x0+b*y0+c*z0+d)/sqrt(a*a+b*b+c*c);
			return distance;
		}
		float getDepth( const in vec2 uv ) {
			return texture2D( tDepth, uv ).x;
		}
		float getViewZ( const in float depth ) {
			#ifdef isPerspectiveCamera
				return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );
			#else
				return orthographicDepthToViewZ( depth, cameraNear, cameraFar );
			#endif
		}
		vec3 getViewPosition( const in vec2 uv, const in float depth/*clip space*/, const in float clipW ) {
			vec4 clipPosition = vec4( ( vec3( uv, depth ) - 0.5 ) * 2.0, 1.0 );//ndc
			clipPosition *= clipW; //clip
			return ( cameraInverseProjectionMatrix * clipPosition ).xyz;//view
		}
		vec3 getViewNormal( const in vec2 uv ) {
			return unpackRGBToNormal( texture2D( tNormal, uv ).xyz );
		}
		vec2 viewPositionToXY(vec3 viewPosition){
			vec2 xy;
			vec4 clip=cameraProjectionMatrix*vec4(viewPosition,1);
			xy=clip.xy;//clip
			float clipW=clip.w;
			xy/=clipW;//NDC
			xy=(xy+1.)/2.;//uv
			xy*=resolution;//screen
			return xy;
		}
		void main(){

			if(uOutputType==0.){
				float depth = getDepth( vUv );
				float viewZ = getViewZ( depth );
				if(-viewZ>=cameraFar) return;
				float clipW = cameraProjectionMatrix[2][3] * viewZ+cameraProjectionMatrix[3][3];
				vec3 viewPosition=getViewPosition( vUv, depth, clipW );
				vec3 worldPosition=(cameraMatrix*vec4(viewPosition,1)).xyz;
				gl_FragColor=vec4(worldPosition,1);return;
			}else{
				vec3 viewNormal=getViewNormal( vUv );
				// viewNormal=normalize(viewNormal);
				// gl_FragColor=vec4(viewNormal,1);return;
				vec3 worldNormal=(cameraRotationMatrix*vec4(viewNormal,1)).xyz;
				// worldNormal=normalize(worldNormal);
				gl_FragColor=vec4(worldNormal,1);return;
			}


		}
	`
};

var WorldNormalShader = {

  defines: {
    MAX_STEP: 0,
    isPerspectiveCamera: true,
    isDistanceAttenuation: true,
    isFresnel: true,
    isInfiniteThick: false,
    isSelective: false,
  },

  uniforms: {

    "tDiffuse": { value: null },
    "tNormal": { value: null },
    "tMetalness": { value: null },
    "tDepth": { value: null },
    "cameraNear": { value: null },
    "cameraFar": { value: null },
    "cameraMatrix": { value: null },
    "cameraRotationMatrix": { value: null },
    "resolution": { value: new Vector2() },
    "cameraProjectionMatrix": { value: new Matrix4() },
    "cameraInverseProjectionMatrix": { value: new Matrix4() },
    "opacity": { value: .5 },
    "maxDistance": { value: 180 },
    "cameraRange": { value: 0 },
    "surfDist": { value: .007 },
    "thickTolerance": { value: .03 },

  },

  vertexShader: /* glsl */`

    varying vec2 vUv;

    void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    }

  `,

  fragmentShader: /* glsl */`
		// precision highp float;
		precision highp sampler2D;
		varying vec2 vUv;
		uniform sampler2D tDepth;
		uniform sampler2D tNormal;
		uniform sampler2D tMetalness;
		uniform sampler2D tDiffuse;
		uniform float cameraRange;
		uniform vec2 resolution;
		uniform float opacity;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraMatrix;
		uniform mat4 cameraRotationMatrix;
		uniform float maxDistance;
		uniform float surfDist;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraInverseProjectionMatrix;
		uniform float thickTolerance;
		#include <packing>
		float pointToLineDistance(vec3 x0, vec3 x1, vec3 x2) {
			//x0: point, x1: linePointA, x2: linePointB
			//https://mathworld.wolfram.com/Point-LineDistance3-Dimensional.html
			return length(cross(x0-x1,x0-x2))/length(x2-x1);
		}
		float pointPlaneDistance(vec3 point,vec3 planePoint,vec3 planeNormal){
			// https://mathworld.wolfram.com/Point-PlaneDistance.html
			//// https://en.wikipedia.org/wiki/Plane_(geometry)
			//// http://paulbourke.net/geometry/pointlineplane/
			float a=planeNormal.x,b=planeNormal.y,c=planeNormal.z;
			float x0=point.x,y0=point.y,z0=point.z;
			float x=planePoint.x,y=planePoint.y,z=planePoint.z;
			float d=-(a*x+b*y+c*z);
			float distance=(a*x0+b*y0+c*z0+d)/sqrt(a*a+b*b+c*c);
			return distance;
		}
		float getDepth( const in vec2 uv ) {
			return texture2D( tDepth, uv ).x;
		}
		float getViewZ( const in float depth ) {
			#ifdef isPerspectiveCamera
				return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );
			#else
				return orthographicDepthToViewZ( depth, cameraNear, cameraFar );
			#endif
		}
		vec3 getViewPosition( const in vec2 uv, const in float depth/*clip space*/, const in float clipW ) {
			vec4 clipPosition = vec4( ( vec3( uv, depth ) - 0.5 ) * 2.0, 1.0 );//ndc
			clipPosition *= clipW; //clip
			return ( cameraInverseProjectionMatrix * clipPosition ).xyz;//view
		}
		vec3 getViewNormal( const in vec2 uv ) {
			return unpackRGBToNormal( texture2D( tNormal, uv ).xyz );
		}
		vec2 viewPositionToXY(vec3 viewPosition){
			vec2 xy;
			vec4 clip=cameraProjectionMatrix*vec4(viewPosition,1);
			xy=clip.xy;//clip
			float clipW=clip.w;
			xy/=clipW;//NDC
			xy=(xy+1.)/2.;//uv
			xy*=resolution;//screen
			return xy;
		}
		void main(){

			float depth = getDepth( vUv );
			float viewZ = getViewZ( depth );
			if(-viewZ>=cameraFar) return;

			float clipW = cameraProjectionMatrix[2][3] * viewZ+cameraProjectionMatrix[3][3];
			vec3 viewPosition=getViewPosition( vUv, depth, clipW );
			vec3 worldPosition=(cameraMatrix*vec4(viewPosition,1)).xyz;
			// gl_FragColor=vec4(worldPosition,1);return;

			vec3 viewNormal=getViewNormal( vUv );
			// viewNormal=normalize(viewNormal);
			// gl_FragColor=vec4(viewNormal,1);return;
			vec3 worldNormal=(cameraRotationMatrix*vec4(viewNormal,1)).xyz;
			// worldNormal=normalize(worldNormal);
			gl_FragColor=vec4(worldNormal,1);return;
		}
	`

};

export { SSRShader, WorldNormalShader };
