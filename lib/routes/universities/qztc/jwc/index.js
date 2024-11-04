const got = require('@/utils/got');
const cheerio = require('cheerio');
const resolve_url = require('url').resolve;

const base_url = 'https://www.qztc.edu.cn/jwc';

const map = {
    jwdt: '/jwdt/list.htm', // 教务动态
    1020: '/1020/list.htm', // 首 页
    1021: '/1021/list.htm', // 岗位介绍
    1022: '/1022/list.htm', // 管理文件
    1023: '/1023/list.htm', // 教学教改
    1024: '/1024/list.htm', // 办事指南
    1025: '/1025/list.htm', // 通知公告
    1026: '/1026/list.htm', // 下载中心
    1027: '/1027/list.htm', // 对外交流
    1028: '/1028/list.htm', // 政策文件
    1029: '/1029/list.htm', // 会议纪要
    // '1949': '/1949/list.htm', // 学院简介
    // '1950': '/1950/list.htm', // 学院领导
    // '1951': '/1951/list.htm', // 组织机构
};

const feedIdMap = {
    jwdt: '/jwdt/list.htm', // 教务动态
    1020: '/1020/list.htm', // 首 页
    1021: '/1021/list.htm', // 岗位介绍
    1022: '/1022/list.htm', // 管理文件
    1023: '/1023/list.htm', // 教学教改
    1024: '/1024/list.htm', // 办事指南
    1025: '/1025/list.htm', // 通知公告
    1026: '/1026/list.htm', // 下载中心
    1027: '/1027/list.htm', // 对外交流
    1028: '/1028/list.htm', // 政策文件
    1029: '/1029/list.htm', // 会议纪要
    // '1949': '/1949/list.htm', // 学院简介
    // '1950': '/1950/list.htm', // 学院领导
    // '1951': '/1951/list.htm', // 组织机构
};

module.exports = async (ctx) => {
    const type = ctx.params.type;
    const link = `${base_url}${map[type]}`;

    const response = await got({
        method: 'get',
        url: link,
        headers: {
            Referer: link,
        },
    });

    const $ = cheerio.load(response.data);

    const list = $('.news.clearfix')
        .toArray()
        .map((item) => {
            const cheerioItem = $(item);
            const a = cheerioItem.find('a');

            try {
                const title = a.attr('title') || '';
                let link = a.attr('href');
                if (!link) {
                    link = '';
                } else if (!link.startsWith('http')) {
                    link = resolve_url(base_url, link);
                }
                const pubDate = new Date(cheerioItem.find('.news_meta').text());

                return {
                    title,
                    link,
                    pubDate,
                };
            } catch {
                return {
                    title: '',
                    link: '',
                    pubDate: new Date(),
                };
            }
        })
        .filter((item) => item.title && item.link);

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const newItem = {
                    ...item,
                    description: '',
                };
                if (new URL(item.link).hostname === 'www.qztc.edu.cn') {
                    if (new URL(item.link).pathname.startsWith('/_upload')) {
                        // 链接为一个文件，直接返回链接
                        newItem.description = item.link;
                    } else {
                        const response = await got({
                            method: 'get',
                            url: item.link,
                            headers: {
                                Referer: item.link,
                            },
                        });
                        const $ = cheerio.load(response.data);
                        newItem.description = $('.wp_articlecontent').html() || '';
                    }
                } else {
                    // 涉及到其他站点，不方便做统一的 html 解析，直接返回链接
                    newItem.description = item.link;
                }
                return newItem;
            })
        )
    );

    ctx.state.data = {
        link,
        title: $('head > title').text() + ' - 泉州师范学院-教务处',
        description: `feedId:${feedIdMap[type]}+userId:44386223835065344`,
        item: items,
    };
};
