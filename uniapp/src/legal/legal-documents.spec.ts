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
      USER_AGREEMENT: "2026-11-23",
      PRIVACY_POLICY: "2026-11-23",
    });
    expect(userAgreementDocument.operatorName).toBe(LEGAL_OPERATOR_NAME);
    expect(userAgreementDocument.version).toBe(LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT);
    expect(privacyPolicyDocument.operatorName).toBe(LEGAL_OPERATOR_NAME);
    expect(privacyPolicyDocument.version).toBe(LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY);
    for (const document of [userAgreementDocument, privacyPolicyDocument]) {
      expect(document.effectiveDate).toBe("2026-11-23");
      const details = document.sections[0].bullets;
      expect(details).toContain("统一社会信用代码：92410211MA9N0J4G2T");
      expect(details).toContain("经营地址：河南省开封市示范区四大街碧桂园31号楼106号商铺");
    }
    expect(userAgreementDocument.sections[0].bullets).toContain("河南省食品小经营店登记证编号：JYDJ241020214015189");
    expect(userAgreementDocument.sections.at(-1)?.bullets).toContain("市场监管投诉举报电话：12315");
  });

  it("covers the required user-agreement structure", () => {
    const titles = userAgreementDocument.sections.map((section) => section.title);

    expect(titles).toEqual(
      expect.arrayContaining([
        "协议接受、服务主体与适用范围",
        "服务范围",
        "账户注册、登录与安全",
        "商品信息",
        "订单与价格",
        "取消与售后",
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
    expect(text).toContain("本店负责配送的人员会使用送达所需的收货信息完成配送");
    const delivery = userAgreementDocument.sections.find((section) => section.title === "堂食、自取与配送");
    expect(delivery?.paragraphs.join("\n")).toContain("配送由开封市示范区赵美红小吃店自行完成");
  });

  it("states authentication and authorization boundaries without expanding consent", () => {
    const text = privacyPolicyDocument.sections
      .flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])])
      .join("\n");

    expect(text).toMatch(/微信动态 code[^。；]*对应认证/);
    expect(text).toMatch(/拒绝[^。；]*微信手机号授权后[^。；]*浏览商品/);
    expect(text).toContain("手动填写收货地址并保存，再从地址簿中选择本单使用的地址");
    expect(text).toContain("门店自取无需收货地址");
    expect(text).toMatch(/协议同意[^。；]*营销同意/);
  });

  it("publishes the verified store contact and describes offline payment", () => {
    for (const document of [userAgreementDocument, privacyPolicyDocument]) {
      expect(document.sections.at(-1)?.bullets).toContain("店铺客服电话：17683242528");
      const text = document.sections.flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])]).join("\n");
      expect(text).toContain("小程序不支持线上支付");
    }
    expect(userAgreementDocument.sections.find((section) => section.title === "订单与价格")?.paragraphs.join("\n")).toContain("下单后，您需按订单显示的应付金额线下付款");
  });

  it("explains retention conditions and how guardians can exercise rights", () => {
    const allText = [userAgreementDocument, privacyPolicyDocument]
      .flatMap((document) => [
        ...document.introduction,
        ...document.sections.flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])]),
      ])
      .join("\n");

    const storage = privacyPolicyDocument.sections.find((section) => section.title === "信息存储与保存期限");
    expect(storage?.bullets).toEqual(expect.arrayContaining([
      expect.stringMatching(/订单及配送记录.*依法仍需保存/),
      expect.stringMatching(/地址簿.*删除该地址或账户注销/),
      expect.stringMatching(/设备信息和运行日志.*故障排查/),
    ]));
    expect(allText).toContain("请由监护人使用自己的账号和联系方式代为下单");
    expect(allText).toMatch(/监护人发现儿童的个人信息.*店铺客服电话/);
    expect(allText).not.toContain("【正式发布前补充】");
    expect(allText).not.toContain("业务初稿");
    expect(allText).toContain("中国大陆的腾讯云北京地域");
  });

  it("routes account cancellation and privacy requests to the store phone", () => {
    const agreementText = userAgreementDocument.sections
      .flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])])
      .join("\n");
    const privacyText = privacyPolicyDocument.sections
      .flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])])
      .join("\n");

    for (const text of [agreementText, privacyText]) {
      expect(text).not.toContain("小程序已提供的账户入口");
      expect(text).not.toContain("已提供的账户入口");
      expect(text).toContain("如需注销账号，请拨打店铺客服电话 17683242528");
    }
    expect(privacyText).toContain("拨打店铺客服电话 17683242528 提出请求");
  });
});
