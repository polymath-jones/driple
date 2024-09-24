const std = @import("std");

const number_of_pages = 10;

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{
        .default_target = .{
            .cpu_arch = .wasm32,
            .os_tag = .freestanding,
        },
    });

    const lib = b.addSharedLibrary(.{
        .name = "processor",
        .root_source_file = .{ .path = "./main.zig" },
        .target = target,
        .optimize = .ReleaseSmall,
    });

    // <https://github.com/ziglang/zig/issues/8633>
    lib.rdynamic = true;
    lib.stack_size = std.wasm.page_size;
    lib.initial_memory = std.wasm.page_size * number_of_pages;
    // lib.import_memory = true;
    // lib.max_memory = std.wasm.page_size * number_of_pages;
    b.installArtifact(lib);
}
