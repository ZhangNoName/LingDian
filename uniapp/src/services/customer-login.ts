import { shallowRef } from "vue";

type CustomerPage = ReturnType<typeof getCurrentPages>[number];

type LoginRequest = {
  id: number;
  page: CustomerPage;
  result: Promise<boolean>;
  finish: (signedIn: boolean) => void;
};

const pending = shallowRef<LoginRequest>();
let nextId = 0;

export function currentCustomerPage(): CustomerPage | undefined {
  return getCurrentPages().slice(-1)[0];
}

export function customerLoginForPage(page: CustomerPage | undefined): LoginRequest | undefined {
  return pending.value?.page === page ? pending.value : undefined;
}

export function openCustomerLogin(page: CustomerPage | undefined): Promise<boolean> {
  if (!page || page !== currentCustomerPage()) return Promise.resolve(false);
  if (pending.value?.page === page) return pending.value.result;
  pending.value?.finish(false);

  let resolve!: (signedIn: boolean) => void;
  const result = new Promise<boolean>((complete) => { resolve = complete; });
  const request: LoginRequest = {
    id: ++nextId,
    page,
    result,
    finish(signedIn) {
      if (pending.value !== request) return;
      pending.value = undefined;
      resolve(signedIn);
    },
  };
  pending.value = request;
  return result;
}
