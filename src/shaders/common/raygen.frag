Ray rayGen(in vec2 uv, out float pdf) {
    vec3 pinholePos = camera.camPos + camera.a * camera.camForward;
    vec3 sensorPos = camera.camPos + uv.x * camera.camRight + uv.y * camera.camUp;

    Ray ray;
    ray.origin = camera.camPos;
    ray.direction = normalize(pinholePos - sensorPos);

    // pdfPos = 1 / lensArea;

    // pdf: solid angle probability density
    float cosineTheta = dot(ray.direction, camera.camForward);
    // pdfDir
    pdf = 1.0 / pow(cosineTheta, 3.0);

    pdf = 1.;
    return ray;
}