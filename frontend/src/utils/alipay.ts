/**
 * 支付宝支付表单提交
 *
 * 后端 alipay.trade.page.pay 返回的是一段「带自动提交脚本的 <form>」HTML。
 * 把它写进一个新开的标签页文档里，浏览器会自动 POST 到支付宝网关，跳到收银台。
 * 用新标签页而不是当前页跳转：付款期间当前页保留，方便轮询订单状态。
 */
export function openAlipayForm(payFormHtml: string): Window | null {
  const win = window.open('', '_blank')
  if (!win) {
    // 被浏览器拦截弹窗
    return null
  }
  win.document.open()
  win.document.write(payFormHtml)
  win.document.close()
  return win
}
