export default /* glsl */`
#define NORMAL

uniform float opacity;

#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )

	varying vec3 vViewPosition;

#endif

#ifndef FLAT_SHADED

	varying vec3 vNormal;

	#ifdef USE_TANGENT

		varying vec3 vTangent;
		varying vec3 vBitangent;

	#endif

#endif

#include <packing>
#include <uv_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

mat4 extractRotation( mat4 me ) {

	// this method does not support reflection matrices

	mat4 te = mat4(
		1,0,0,0,
		0,1,0,0,
		0,0,1,0,
		0,0,0,1
	);


	float scaleX = 1. / length(vec3(me[0][0],me[0][1],me[0][2]));
	float scaleY = 1. / length(vec3(me[1][0],me[1][1],me[1][2]));
	float scaleZ = 1. / length(vec3(me[2][0],me[2][1],me[2][2]));

	te[0][ 0 ] = me[0][ 0 ]*scaleX;
	te[0][ 1 ] = me[0][ 1 ]*scaleX;
	te[0][ 2 ] = me[0][ 2 ]*scaleX;
	te[0][ 3 ] = 0.;

	te[1][ 0 ] = me[1][ 0 ]*scaleY;
	te[1][ 1 ] = me[1][ 1 ]*scaleY;
	te[1][ 2 ] = me[1][ 2 ]*scaleY;
	te[1][ 3 ] = 0.;

	te[2][ 0 ]= me[2][ 0 ]*scaleZ;
	te[2][ 1 ]= me[2][ 1 ]*scaleZ;
	te[2][ 2 ] = me[2][ 2 ]*scaleZ;
	te[2][ 3 ] = 0.;

	te[3][ 0 ] = 0.;
	te[3][ 1 ] = 0.;
	te[3][ 2 ] = 0.;
	te[3][ 3 ] = 1.;

	return te;

}

void main() {

	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>

	mat4 rotationMatrix=extractRotation(viewMatrix);
	// mat4 rotationMatrix=mat4(
	// 	1,0,0,0,
	// 	0,1,0,0,
	// 	0,0,1,0,
	// 	0,0,0,1
	// );
	rotationMatrix=inverse(rotationMatrix);
	vec3 worldNormal=(rotationMatrix*vec4(normal,1)).xyz;
	gl_FragColor = vec4( packNormalToRGB( worldNormal ), opacity );
	// gl_FragColor = vec4( packNormalToRGB( normal ), opacity );

	// gl_FragColor = vec4( viewMatrix[0][0],viewMatrix[0][1],viewMatrix[0][2],1 );
	// gl_FragColor = vec4( viewMatrix[1][0],viewMatrix[1][1],viewMatrix[1][2],1 );
	// gl_FragColor = vec4( viewMatrix[2][0],viewMatrix[2][1],viewMatrix[2][2],1 );
	// gl_FragColor = vec4( viewMatrix[3][0],viewMatrix[3][1],viewMatrix[3][2],1 );

}
`;
/*
	envmap_physical_pars_fragment.glsl.js
		vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );
*/
