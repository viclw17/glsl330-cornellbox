#version 330 core

#include common/global.frag
#include common/uniform.frag
#include common/rng.frag
#include common/raygen.frag
#include common/util.frag
#include common/intersect.frag
#include common/closest_hit.frag
#include common/sampling.frag
#include common/brdf.frag

in vec2 texCoord;

layout (location = 0) out vec3 color;
layout (location = 1) out uint state;

vec3 computeRadiance(in Ray ray_in) {
    Ray ray = ray_in;

    float russian_roulette_prob = 1;
    vec3 color = vec3(0);
    vec3 throughput = vec3(1);

    for(int i = 0; i < MAX_DEPTH; ++i) {
        // russian roulette
        // the more light bounce
        // the smaller Throughput
        // the smaller russian_roulette_prob will be set: [min(throughput_max_element, 1.0)]
        // then random() is more possible to be bigger than it
        // then break the loop
        if(random() >= russian_roulette_prob) {
           break; // this path ends here
        }
        // > when didnt fail on russian_roulette, the division by p compensates for times where we miss it
        // scale up throughput 
        throughput /= russian_roulette_prob;

        IntersectInfo info;

        if(intersect(ray, info)) {
            Primitive hitPrimitive = primitives[info.primID];
            Material hitMaterial = materials[hitPrimitive.material_id];
            vec3 wo = -ray.direction;
            vec3 wo_local = worldToLocal(wo, info.dpdu, info.hitNormal, info.dpdv);

            // Le 
            if(any(greaterThan(hitMaterial.le, vec3(0)))) {
                color += throughput * hitMaterial.le;
                break;
            }

            // BRDF Sampling
            float pdf;
            vec3 wi_local;
            // receiving sampling pdf
            // material contains type ID,kd,le emissive
            vec3 brdf = sampleBRDF(wo_local, wi_local, hitMaterial, pdf);
            // prevent NaN
            if(pdf == 0.0) {
                break;
            }
            vec3 wi = localToWorld(wi_local, info.dpdu, info.hitNormal, info.dpdv);

            // update throughput
            // quick calculation
            float cos_term = abs(wi_local.y);
            // throughput *= brdf * cos_term / pdf;
            // throughput is scaling down by brdf, by sampling, by surface cosine
            throughput *= brdf * (1 / pdf) * cos_term;

            // update russian roulette probability
            // russian_roulette_prob is set to be max_coefficient(throughput), as throughput is RGB
            float throughput_max_element = max(max(throughput.x, throughput.y), throughput.z);
            // > the rarity / multiplier of later bounces is growing continuously
            // > here we are choosing p_RR dynamically: compute it at each bounce according to possible color contribution, aka throughput
            // russian_roulette_prob is set to 1 or less than 1
            russian_roulette_prob = min(throughput_max_element, 1.0);

            // set next ray
            ray = Ray(info.hitPos, wi);
        }
        else {
            color += throughput * vec3(0);
            break;
        }
    }

    return color;
}

void main() {
    // set RNG seed
    setSeed(texCoord);

    // generate initial ray, for AA
    // set to x100 will blur the image
    float blur_amount = 0;
    vec2 random_offset = vec2(random(), random())*blur_amount-blur_amount/2;
    vec2 uv = (2.0*(gl_FragCoord.xy + random_offset) - resolution) * resolutionYInv;
    
    // flip vertically
    uv.y = -uv.y; 
    
    // cam ray
    float pdf;
    Ray ray = rayGen(uv, pdf);
    // angle btw cam ray and cam forward
    float cos_term = dot(camera.camForward, ray.direction);

    // accumulate sampled color on accumTexture
    vec3 radiance = computeRadiance(ray) / pdf;

    color = texture(accumTexture, texCoord).xyz + radiance * cos_term;
    // color = vec3(uv,0);

    // save RNG state on stateTexture
    state = RNG_STATE.a;
}