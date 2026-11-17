package com.bjut.cs.ticket.common.enums;

import lombok.Getter;

@Getter
public enum ShowCategory {
    CONCERT("演唱会"),
    DRAMA("话剧"),
    MUSIC_FESTIVAL("音乐节"),
    CONCERT_CLASSICAL("音乐会"),
    DANCE("舞蹈"),
    SPORTS("体育赛事"),
    EXHIBITION("展览"),
    OTHER("其他");

    private final String label;

    ShowCategory(String label) {
        this.label = label;
    }
}
