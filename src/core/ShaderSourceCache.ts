interface Source { vertexShader: string; fragmentShader: string }

/** One immutable source pair, never shader uniforms or material state. */
export class ShaderSourceCache {
  private vertex: string | null = null
  private fragment: string | null = null
  private patchedVertex = ''
  private patchedFragment = ''

  reuse(shader: Source): boolean {
    if (shader.vertexShader !== this.vertex || shader.fragmentShader !== this.fragment) return false
    shader.vertexShader = this.patchedVertex; shader.fragmentShader = this.patchedFragment
    return true
  }

  remember(vertex: string, fragment: string, shader: Source): void {
    this.vertex = vertex; this.fragment = fragment
    this.patchedVertex = shader.vertexShader; this.patchedFragment = shader.fragmentShader
  }
}
