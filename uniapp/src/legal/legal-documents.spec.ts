import { LEGAL_DOCUMENT_VERSIONS } from "@lingdian/contracts";
import { describe, expect, it } from "vitest";
import {
  LEGAL_OPERATOR_NAME,
  privacyPolicyDocument,
  userAgreementDocument,
} from "./legal-documents";

describe("legal documents", () => {
  it("identifies the operator and uses the current contract versions", () => {
    expect(LEGAL_OPERATOR_NAME).toBe("开封市示范区赵美红小吃店");
    expect(LEGAL_DOCUMENT_VERSIONS).toEqual({
      USER_AGREEMENT: "2026-08-17",
      PRIVACY_POLICY: "2026-08-17",
    });
    expect(userAgreementDocument.operatorName).toBe(LEGAL_OPERATOR_NAME);
    expect(userAgreementDocument.version).toBe(LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT);
    expect(privacyPolicyDocument.operatorName).toBe(LEGAL_OPERATOR_NAME);
    expect(privacyPolicyDocument.version).toBe(LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY);
  });

  it("covers the required user-agreement structure", () => {
    const titles = userAgreementDocument.sections.map((section) => section.title);

    expect(titles).toEqual(
      expect.arrayContaining([
        "协议接受、服务主体与适用范围",
        "服务范围",
        "账户注册、登录与安全",
        "商品信息",
        "订单、价格与支付",
        "取消、退款与售后",
        "堂食、自取与配送",
        "用户行为规范",
        "知识产权",
        "服务变更、中断与终止",
        "责任边界",
        "未成年人使用",
        "账户注销",
        "争议解决与联系我们",
      ]),
    );
  });

  it("covers the required privacy-policy structure", () => {
    const titles = privacyPolicyDocument.sections.map((section) => section.title);

    expect(titles).toEqual(
      expect.arrayContaining([
        "个人信息处理者",
        "个人信息的收集与使用",
        "敏感个人信息",
        "系统权限与拒绝授权的影响",
        "第三方服务与受托处理",
        "信息存储与保存期限",
        "您的个人信息权利",
        "账户注销与信息删除",
        "信息安全与安全事件",
        "未成年人个人信息保护",
        "政策更新与联系我们",
      ]),
    );
  });

  it("describes every personal-information category used by the current product", () => {
    const text = privacyPolicyDocument.sections
      .flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])])
      .join("\n");

    for (const item of ["手机号", "微信身份", "头像", "昵称", "收货地址", "订单信息", "设备与日志"]) {
      expect(text).toContain(item);
    }
  });

  it("states authentication and authorization boundaries without expanding consent", () => {
    const text = privacyPolicyDocument.sections
      .flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])])
      .join("\n");

    expect(text).toMatch(/验证码[^。；]*对应认证/);
    expect(text).toMatch(/微信动态 code[^。；]*对应认证/);
    expect(text).toMatch(/拒绝[^。；]*微信手机号授权[^。；]*短信登录/);
    expect(text).toMatch(/拒绝[^。；]*地址授权[^。；]*门店自取/);
    expect(text).toMatch(/协议同意[^。；]*营销同意/);
  });

  it("marks unknown release facts with the required placeholder", () => {
    const allText = [userAgreementDocument, privacyPolicyDocument]
      .flatMap((document) => [
        ...document.introduction,
        ...document.sections.flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])]),
      ])
      .join("\n");

    for (const fact of [
      "统一社会信用代码",
      "注册地址",
      "客服电话",
      "客服邮箱",
      "第三方服务商名称",
      "具体保存期限",
    ]) {
      expect(allText).toMatch(new RegExp(`${fact}[^\n]*【正式发布前补充】`));
    }
  });
});
