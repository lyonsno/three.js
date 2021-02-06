#version 300 es
#define varying in
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define gl_FragDepthEXT gl_FragDepth
#define texture2D texture
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLodEXT textureLod
#define texture2DProjLodEXT textureProjLod
#define textureCubeLodEXT textureLod
#define texture2DGradEXT textureGrad
#define texture2DProjGradEXT textureProjGrad
#define textureCubeGradEXT textureGrad
precision highp float;
precision highp int;
#define HIGH_PRECISION
#define SHADER_NAME MeshNormalMaterial
#define GAMMA_FACTOR 2
#define USE_NORMALMAP
#define TANGENTSPACE_NORMALMAP
#define USE_UV
#define DOUBLE_SIDED
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;

// For a discussion of what this is, please read this: http://lousodrome.net/blog/light/2013/05/26/gamma-correct-and-hdr-rendering-in-a-32-bits-buffer/


vec4 LinearToLinear( in vec4 value ) {
    return value;
}
vec4 GammaToLinear( in vec4 value, in float gammaFactor ) {
    return vec4( pow( value.rgb, vec3( gammaFactor ) ), value.a );
}
vec4 LinearToGamma( in vec4 value, in float gammaFactor ) {
    return vec4( pow( value.rgb, vec3( 1.0 / gammaFactor ) ), value.a );
}
vec4 sRGBToLinear( in vec4 value ) {
    return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 LinearTosRGB( in vec4 value ) {
    return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 RGBEToLinear( in vec4 value ) {
    return vec4( value.rgb * exp2( value.a * 255.0 - 128.0 ), 1.0 );
}
vec4 LinearToRGBE( in vec4 value ) {
    float maxComponent = max( max( value.r, value.g ), value.b );
    float fExp = clamp( ceil( log2( maxComponent ) ), -128.0, 127.0 );
    return vec4( value.rgb / exp2( fExp ), ( fExp + 128.0 ) / 255.0 );
    // return vec4( value.brg, ( 3.0 + 128.0 ) / 256.0 );
}
// reference: http://iwasbeingirony.blogspot.ca/2010/06/difference-between-rgbm-and-rgbd.html
vec4 RGBMToLinear( in vec4 value, in float maxRange ) {
    return vec4( value.rgb * value.a * maxRange, 1.0 );
}
vec4 LinearToRGBM( in vec4 value, in float maxRange ) {
    float maxRGB = max( value.r, max( value.g, value.b ) );
    float M = clamp( maxRGB / maxRange, 0.0, 1.0 );
    M = ceil( M * 255.0 ) / 255.0;
    return vec4( value.rgb / ( M * maxRange ), M );
}
// reference: http://iwasbeingirony.blogspot.ca/2010/06/difference-between-rgbm-and-rgbd.html
vec4 RGBDToLinear( in vec4 value, in float maxRange ) {
    return vec4( value.rgb * ( ( maxRange / 255.0 ) / value.a ), 1.0 );
}
vec4 LinearToRGBD( in vec4 value, in float maxRange ) {
    float maxRGB = max( value.r, max( value.g, value.b ) );
    float D = max( maxRange / maxRGB, 1.0 );
    // NOTE: The implementation with min causes the shader to not compile on
    
    // a common Alcatel A502DL in Chrome 78/Android 8.1. Some research suggests 
    // that the chipset is Mediatek MT6739 w/ IMG PowerVR GE8100 GPU.
    // D = min( floor( D ) / 255.0, 1.0 );
    D = clamp( floor( D ) / 255.0, 0.0, 1.0 );
    return vec4( value.rgb * ( D * ( 255.0 / maxRange ) ), D );
}
// LogLuv reference: http://graphicrants.blogspot.ca/2009/04/rgbm-color-encoding.html

// M matrix, for encoding
const mat3 cLogLuvM = mat3( 0.2209, 0.3390, 0.4184, 0.1138, 0.6780, 0.7319, 0.0102, 0.1130, 0.2969 );
vec4 LinearToLogLuv( in vec4 value ) {
    vec3 Xp_Y_XYZp = cLogLuvM * value.rgb;
    Xp_Y_XYZp = max( Xp_Y_XYZp, vec3( 1e-6, 1e-6, 1e-6 ) );
    vec4 vResult;
    vResult.xy = Xp_Y_XYZp.xy / Xp_Y_XYZp.z;
    float Le = 2.0 * log2(Xp_Y_XYZp.y) + 127.0;
    vResult.w = fract( Le );
    vResult.z = ( Le - ( floor( vResult.w * 255.0 ) ) / 255.0 ) / 255.0;
    return vResult;
}
// Inverse M matrix, for decoding
const mat3 cLogLuvInverseM = mat3( 6.0014, -2.7008, -1.7996, -1.3320, 3.1029, -5.7721, 0.3008, -1.0882, 5.6268 );
vec4 LogLuvToLinear( in vec4 value ) {
    float Le = value.z * 255.0 + value.w;
    vec3 Xp_Y_XYZp;
    Xp_Y_XYZp.y = exp2( ( Le - 127.0 ) / 2.0 );
    Xp_Y_XYZp.z = Xp_Y_XYZp.y / value.y;
    Xp_Y_XYZp.x = value.x * Xp_Y_XYZp.z;
    vec3 vRGB = cLogLuvInverseM * Xp_Y_XYZp.rgb;
    return vec4( max( vRGB, 0.0 ), 1.0 );
}
vec4 linearToOutputTexel( vec4 value ) {
    return LinearToLinear( value );
}
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


vec3 packNormalToRGB( const in vec3 normal ) {
    return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
    return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)

const float UnpackDownscale = 255. / 256.; // 0..1 -> fraction (excluding 1)


const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA( const in float v ) {
    vec4 r = vec4( fract( v * PackFactors ), v );
    r.yzw -= r.xyz * ShiftRight8; // tidy overflow
    
    return r * PackUpscale;
}
float unpackRGBAToDepth( const in vec4 v ) {
    return dot( v, UnpackFactors );
}
vec4 pack2HalfToRGBA( vec2 v ) {
    vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ));
    return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w);
}
vec2 unpackRGBATo2Half( vec4 v ) {
    return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
// NOTE: viewZ/eyeZ is < 0 when in front of the camera per OpenGL conventions

float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
    return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float linearClipZ, const in float near, const in float far ) {
    return linearClipZ * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
    return (( near + viewZ ) * far ) / (( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float invClipZ, const in float near, const in float far ) {
    return ( near * far ) / ( ( far - near ) * invClipZ - far );
}
#if ( defined( USE_UV ) && ! defined( UVS_VERTEX_ONLY ) )
    
    varying vec2 vUv;
#endif


#ifdef USE_BUMPMAP
    
    uniform sampler2D bumpMap;
    uniform float bumpScale;
    
    // Bump Mapping Unparametrized Surfaces on the GPU by Morten S. Mikkelsen
    
    // http://api.unrealengine.com/attachments/Engine/Rendering/LightingAndShadows/BumpMappingWithoutTangentSpace/mm_sfgrad_bump.pdf
    
    // Evaluate the derivative of the height w.r.t. screen-space using forward differencing (listing 2)
    
    vec2 dHdxy_fwd() {
        vec2 dSTdx = dFdx( vUv );
        vec2 dSTdy = dFdy( vUv );
        float Hll = bumpScale * texture2D( bumpMap, vUv ).x;
        float dBx = bumpScale * texture2D( bumpMap, vUv + dSTdx ).x - Hll;
        float dBy = bumpScale * texture2D( bumpMap, vUv + dSTdy ).x - Hll;
        return vec2( dBx, dBy );
    }
    vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
        // Workaround for Adreno 3XX dFd*( vec3 ) bug. See #9988
        
        vec3 vSigmaX = vec3( dFdx( surf_pos.x ), dFdx( surf_pos.y ), dFdx( surf_pos.z ) );
        vec3 vSigmaY = vec3( dFdy( surf_pos.x ), dFdy( surf_pos.y ), dFdy( surf_pos.z ) );
        vec3 vN = surf_norm;		// normalized
        
        
        vec3 R1 = cross( vSigmaY, vN );
        vec3 R2 = cross( vN, vSigmaX );
        float fDet = dot( vSigmaX, R1 ) * faceDirection;
        vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
        return normalize( abs( fDet ) * surf_norm - vGrad );
    }
#endif


#ifdef USE_NORMALMAP
    
    uniform sampler2D normalMap;
    uniform vec2 normalScale;
#endif

#ifdef OBJECTSPACE_NORMALMAP
    
    uniform mat3 normalMatrix;
#endif

#if ! defined ( USE_TANGENT ) && ( defined ( TANGENTSPACE_NORMALMAP ) || defined ( USE_CLEARCOAT_NORMALMAP ) )
    
    // Per-Pixel Tangent Space Normal Mapping
    // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html
    
    vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {
        // Workaround for Adreno 3XX dFd*( vec3 ) bug. See #9988
        
        vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );
        vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );
        vec2 st0 = dFdx( vUv.st );
        vec2 st1 = dFdy( vUv.st );
        float scale = sign( st1.t * st0.s - st0.t * st1.s ); // we do not care about the magnitude
        
        
        vec3 S = normalize( ( q0 * st1.t - q1 * st0.t ) * scale );
        vec3 T = normalize( ( - q0 * st1.s + q1 * st0.s ) * scale );
        vec3 N = normalize( surf_norm );
        mat3 tsn = mat3( S, T, N );
        mapN.xy *= faceDirection;
        return normalize( tsn * mapN );
    }
#endif


#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
    
    uniform float logDepthBufFC;
    varying float vFragDepth;
    varying float vIsPerspective;
#endif


#if 0 > 0
    
    varying vec3 vClipPosition;
    uniform vec4 clippingPlanes[ 0 ];
#endif


void main() {
    #if 0 > 0
        
        vec4 plane;
        #if 0 < 0
            
            bool clipped = true;
            if ( clipped ) discard;
        #endif
        
    #endif
    
    
    #if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
        
        // Doing a strict comparison with == 1.0 can cause noise artifacts
        // on some platforms. See issue #17623.
        gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
    #endif
    
    
    float faceDirection = float( gl_FrontFacing ) * 2.0 - 1.0;
    #ifdef FLAT_SHADED
        
        // Workaround for Adreno GPUs not able to do dFdx( vViewPosition )
        
        vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );
        vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );
        vec3 normal = normalize( cross( fdx, fdy ) );
    #else
        
        vec3 normal = normalize( vNormal );
        #ifdef DOUBLE_SIDED
            
            normal = normal * faceDirection;
        #endif
        
        #ifdef USE_TANGENT
            
            vec3 tangent = normalize( vTangent );
            vec3 bitangent = normalize( vBitangent );
            #ifdef DOUBLE_SIDED
                
                tangent = tangent * faceDirection;
                bitangent = bitangent * faceDirection;
            #endif
            
            #if defined( TANGENTSPACE_NORMALMAP ) || defined( USE_CLEARCOAT_NORMALMAP )
                
                mat3 vTBN = mat3( tangent, bitangent, normal );
            #endif
            
        #endif
        
    #endif
    
    // non perturbed normal for clearcoat among others
    
    vec3 geometryNormal = normal;
    #ifdef OBJECTSPACE_NORMALMAP
        
        normal = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals
        
        
        #ifdef FLIP_SIDED
            
            normal = - normal;
        #endif
        
        #ifdef DOUBLE_SIDED
            
            normal = normal * faceDirection;
        #endif
        
        normal = normalize( normalMatrix * normal );
        #elif defined( TANGENTSPACE_NORMALMAP )
        
        vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
        mapN.xy *= normalScale;
        #ifdef USE_TANGENT
            
            normal = normalize( vTBN * mapN );
        #else
            
            normal = perturbNormal2Arb( -vViewPosition, normal, mapN, faceDirection );
        #endif
        
        #elif defined( USE_BUMPMAP )
        
        normal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd(), faceDirection );
    #endif
    
    
    gl_FragColor = vec4( packNormalToRGB( normal ), opacity );
}
