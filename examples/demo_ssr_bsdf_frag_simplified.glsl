#version 300 es

#define varying in
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
precision highp float;
precision highp int;
#define STANDARD 
#define ENVMAP_TYPE_CUBE_UV
#define ENVMAP_MODE_REFLECTION
uniform mat4 viewMatrix;
uniform bool isOrthographic;
#ifndef saturate
    #define saturate(a) clamp( a, 0.0, 1.0 )
#endif
vec4 LinearTosRGB( in vec4 value ) {
    return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 linearToOutputTexel( vec4 value ) {
    return LinearTosRGB( value );
}
#define STANDARD
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
    varying vec3 vNormal;
#endif
#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
    #define saturate(a) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement(a) ( 1.0 - saturate( a ) )
float pow2( const in float x ) {
    return x*x;
}
struct IncidentLight {
    vec3 color;
    vec3 direction;
    bool visible;
};
struct ReflectedLight {
    vec3 directDiffuse;
    vec3 directSpecular;
    vec3 indirectDiffuse;
    vec3 indirectSpecular;
};
struct GeometricContext {
    vec3 position;
    vec3 normal;
    vec3 viewDir;
};
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
    return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
const float UnpackDownscale = 255. / 256.;
const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
#if ( ! defined( UVS_VERTEX_ONLY ) )
    varying vec2 vUv;
#endif
vec2 integrateSpecularBRDF( const in float dotNV, const in float roughness ) {
    const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
    const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
    vec4 r = roughness * c0 + c1;
    float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
    return vec2( -1.04, 1.04 ) * a004 + r.zw;
}
float punctualLightIntensityToIrradianceFactor( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
    if( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
        return pow( saturate( -lightDistance / cutoffDistance + 1.0 ), decayExponent );
    }
    return 1.0;
}
vec3 BRDF_Diffuse_Lambert( const in vec3 diffuseColor ) {
    return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 specularColor, const in float dotLH ) {
    float fresnel = exp2( ( -5.55473 * dotLH - 6.98316 ) * dotLH );
    return ( 1.0 - specularColor ) * fresnel + specularColor;
}
vec3 F_Schlick_RoughnessDependent( const in vec3 F0, const in float dotNV, const in float roughness ) {
    float fresnel = exp2( ( -5.55473 * dotNV - 6.98316 ) * dotNV );
    vec3 Fr = max( vec3( 1.0 - roughness ), F0 ) - F0;
    return Fr * fresnel + F0;
}
float G_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
    float a2 = pow2( alpha );
    float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
    float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
    return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
    float a2 = pow2( alpha );
    float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
    return RECIPROCAL_PI * a2 / pow2( denom );
}
vec3 BRDF_Specular_GGX( const in IncidentLight incidentLight, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float roughness ) {
    float alpha = pow2( roughness );
    vec3 halfDir = normalize( incidentLight.direction + viewDir );
    float dotNL = saturate( dot( normal, incidentLight.direction ) );
    float dotNV = saturate( dot( normal, viewDir ) );
    float dotNH = saturate( dot( normal, halfDir ) );
    float dotLH = saturate( dot( incidentLight.direction, halfDir ) );
    vec3 F = F_Schlick( specularColor, dotLH );
    float G = G_GGX_SmithCorrelated( alpha, dotNL, dotNV );
    float D = D_GGX( alpha, dotNH );
    return F * ( G * D );
}
void BRDF_Specular_Multiscattering_Environment( const in GeometricContext geometry, const in vec3 specularColor, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
    float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
    vec3 F = F_Schlick_RoughnessDependent( specularColor, dotNV, roughness );
    vec2 brdf = integrateSpecularBRDF( dotNV, roughness );
    vec3 FssEss = F * brdf.x + brdf.y;
    float Ess = brdf.x + brdf.y;
    float Ems = 1.0 - Ess;
    vec3 Favg = specularColor + ( 1.0 - specularColor ) * 0.047619;
    vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
    singleScatter += FssEss;
    multiScatter += Fms * Ems;
}
#ifdef ENVMAP_TYPE_CUBE_UV
    #define cubeUV_maxMipLevel 8.0
    #define cubeUV_minMipLevel 4.0
    #define cubeUV_maxTileSize 256.0
    #define cubeUV_minTileSize 16.0
    #define r0 1.0
    #define v0 0.339
    #define m0 - 2.0
    #define r1 0.8
    #define v1 0.276
    #define m1 - 1.0
    #define r4 0.4
    #define v4 0.046
    #define m4 2.0
    #define r5 0.305
    #define v5 0.016
    #define m5 3.0
    #define r6 0.21
    #define v6 0.0038
    #define m6 4.0
#endif
uniform float envMapIntensity;
uniform float flipEnvMap;
uniform int maxMipLevel;
uniform sampler2D envMap;
    
vec3 getLightProbeIndirectIrradiance( const in GeometricContext geometry, const in int maxMIPLevel ) {
    vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );
    vec4 envMapColor = vec4( 0.0 );
    return PI * envMapColor.rgb * envMapIntensity;
}
float getSpecularMIPLevel( const in float roughness, const in int maxMIPLevel ) {
    float maxMIPLevelScalar = float( maxMIPLevel );
    float sigma = PI * roughness * roughness / ( 1.0 + roughness );
    float desiredMIPLevel = maxMIPLevelScalar + log2( sigma );
    return clamp( desiredMIPLevel, 0.0, maxMIPLevelScalar );
}
vec3 getLightProbeIndirectRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in int maxMIPLevel ) {
    vec3 reflectVec = reflect( -viewDir, normal );
    reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
    reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
    float specularMIPLevel = getSpecularMIPLevel( roughness, maxMIPLevel );
    return envMapColor.rgb * envMapIntensity;
}
uniform vec3 ambientLightColor;
uniform vec3 lightProbe[ 9 ];
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
    float x = normal.x, y = normal.y, z = normal.z;
    vec3 result = shCoefficients[ 0 ] * 0.886227;
    result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
    result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
    result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
    result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
    result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
    result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
    result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
    result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
    return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in GeometricContext geometry ) {
    vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );
    vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
    return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
    vec3 irradiance = ambientLightColor;
    #ifndef PHYSICALLY_CORRECT_LIGHTS
        irradiance *= PI;
    #endif
    return irradiance;
}
struct DirectionalLight {
    vec3 direction;
    vec3 color;
};
uniform DirectionalLight directionalLights[ 1 ];
void getDirectionalDirectLightIrradiance( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight directLight ) {
    directLight.color = directionalLight.color;
    directLight.direction = directionalLight.direction;
    directLight.visible = true;
}
struct PointLight {
    vec3 position;
    vec3 color;
    float distance;
    float decay;
};
uniform PointLight pointLights[ 1 ];
void getPointDirectLightIrradiance( const in PointLight pointLight, const in GeometricContext geometry, out IncidentLight directLight ) {
    vec3 lVector = pointLight.position - geometry.position;
    directLight.direction = normalize( lVector );
    float lightDistance = length( lVector );
    directLight.color = pointLight.color;
    directLight.color *= punctualLightIntensityToIrradianceFactor( lightDistance, pointLight.distance, pointLight.decay );
    directLight.visible = ( directLight.color ! = vec3( 0.0 ) );
}
struct PhysicalMaterial {
    vec3 diffuseColor;
    float specularRoughness;
    vec3 specularColor;
};
#define DEFAULT_SPECULAR_COEFFICIENT 0.04
void RE_Direct_Physical( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
    float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
    vec3 irradiance = dotNL * directLight.color;
    #ifndef PHYSICALLY_CORRECT_LIGHTS
        irradiance *= PI;
    #endif
    reflectedLight.directSpecular += irradiance * BRDF_Specular_GGX( directLight, geometry.viewDir, geometry.normal, material.specularColor, material.specularRoughness);
    reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
    reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
    vec3 singleScattering = vec3( 0.0 );
    vec3 multiScattering = vec3( 0.0 );
    vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
    BRDF_Specular_Multiscattering_Environment( geometry, material.specularColor, material.specularRoughness, singleScattering, multiScattering );
    vec3 diffuse = material.diffuseColor * ( 1.0 - ( singleScattering + multiScattering ) );
    reflectedLight.indirectSpecular += radiance * singleScattering;
    reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
    reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
void main() {
    vec4 diffuseColor = vec4( diffuse, opacity );
    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
    vec3 totalEmissiveRadiance = emissive;
    float roughnessFactor = roughness;
    float metalnessFactor = metalness;
    vec3 normal = normalize( vNormal );
    vec3 geometryNormal = normal;
    PhysicalMaterial material;
    material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
    vec3 dxy = max( abs( dFdx( geometryNormal ) ), abs( dFdy( geometryNormal ) ) );
    float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
    material.specularRoughness = max( roughnessFactor, 0.0525 );
    material.specularRoughness += geometryRoughness;
    material.specularRoughness = min( material.specularRoughness, 1.0 );
    material.specularColor = mix( vec3( DEFAULT_SPECULAR_COEFFICIENT ), diffuseColor.rgb, metalnessFactor );
    
    GeometricContext geometry;
    geometry.position = - vViewPosition;
    geometry.normal = normal;
    geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
    IncidentLight directLight;
    PointLight pointLight;
    
    pointLight = pointLights[ 0 ];
    getPointDirectLightIrradiance( pointLight, geometry, directLight );
    RE_Direct( directLight, geometry, material, reflectedLight );
    DirectionalLight directionalLight;
    
    directionalLight = directionalLights[ 0 ];
    getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );
    RE_Direct( directLight, geometry, material, reflectedLight );
    vec3 iblIrradiance = vec3( 0.0 );
    vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
    irradiance += getLightProbeIrradiance( lightProbe, geometry );
    vec3 radiance = vec3( 0.0 );
    vec3 clearcoatRadiance = vec3( 0.0 );
    #if defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
        iblIrradiance += getLightProbeIndirectIrradiance( geometry, maxMipLevel );
    #endif
    radiance += getLightProbeIndirectRadiance( geometry.viewDir, geometry.normal, material.specularRoughness, maxMipLevel );
    RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );
    RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometry, material, reflectedLight );
    vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
    gl_FragColor = vec4( outgoingLight, diffuseColor.a );
    gl_FragColor = linearToOutputTexel( gl_FragColor );
}
