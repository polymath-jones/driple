const std = @import("std");
const main = @import("main.zig");

const Parameters = main.Parameters;

var wa = std.heap.ArenaAllocator.init(std.heap.wasm_allocator);
pub const allocator = wa.allocator();

// IMPORTS
pub extern fn consoleLog(arg: [*]u8) void;

// IMPORTS
pub export fn allocF32(length: u32) [*]const f32 {
    const slice = allocator.alloc(f32, length) catch
        @panic("failed to allocate memory");
    return slice.ptr;
}

pub export fn deallocChannel(pointer: *[128]f32) void {
    allocator.free(pointer);
}

pub export fn deallocParameters(pointer: *Parameters) void {
    allocator.destroy(pointer);
}

pub export fn freeAll() void {
    if (!wa.reset(.free_all)) {
        @panic("failed to free memory");
    }
}

pub export fn allocUint8(length: u32) [*]const u8 {
    const slice = allocator.alloc(u8, length) catch
        @panic("failed to allocate memory");
    return slice.ptr;
}

pub export fn getParametersSize() i64 {
    const p = @sizeOf(Parameters);
    // jslog("size", p);
    return p;
}

// INTERNALS
pub fn jslog(string: anytype, data: anytype) void {
    const d = std.fmt.allocPrint(allocator, "{s}:{any}", .{ string, data }) catch @panic("failed to allocate memory");
    consoleLog(d.ptr);
}
