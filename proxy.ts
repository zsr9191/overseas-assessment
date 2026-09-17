import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 这个函数会在每个请求完成前运行
export function proxy(request: NextRequest) {
  return NextResponse.next()
}

// 可选：配置匹配路径
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，但排除以下路径：
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}