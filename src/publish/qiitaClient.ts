export interface QiitaPostPayload {
  title: string;
  body: string;
  tags: string[];
}

export interface QiitaClientConfig {
  token: string;
  private: boolean;
}

export function createQiitaPostFn(config: QiitaClientConfig): (payload: QiitaPostPayload) => Promise<void> {
  return async (payload: QiitaPostPayload) => {
    const response = await fetch("https://qiita.com/api/v2/items", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        tags: payload.tags.map((name) => ({ name })),
        private: config.private,
      }),
    });

    if (!response.ok) {
      throw new Error(`Qiitaへの投稿に失敗しました(status: ${response.status})`);
    }
  };
}
