// Orthophoto drape. The texture is aligned to the district metre grid.
import * as THREE from 'three';

export function aerialBounds(grid) {
  const spanX = grid.w * grid.cell;
  const spanZ = grid.h * grid.cell;
  return {
    minX: grid.minX,
    minZ: grid.minZ,
    spanX,
    spanZ,
    maxZ: grid.minZ + spanZ,
  };
}

export function aerialTexture(url) {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 16;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function photoMaterial(tex) {
  // Unlit, so the photograph keeps the colours the camera recorded.
  return new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
}

export function worldUvMesh(positions, material, bounds) {
  const count = positions.length / 3;
  const uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    uv[i * 2] = (positions[i * 3] - bounds.minX) / bounds.spanX;
    uv[i * 2 + 1] = (bounds.maxZ - positions[i * 3 + 2]) / bounds.spanZ;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = false;
  return mesh;
}
